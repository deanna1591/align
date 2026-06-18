'use client';

// components/PhotoBooth.jsx
// PHOTOBOOTH.EXE — a vintage Y2K photobooth that lives in the Today view.
// 3 shots with countdown + flash → composed into a strip with a date stamp →
// "prints" out with a notchy animation → pins to the wall. Strips are stored
// in a private Supabase bucket (signed URLs) and persist forever.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase-client';

const C = {
  ink: '#36215C', ink2: '#6E5499', ink3: '#9F88C9',
  border: '#C9B8E6', accent: '#FF5FB0', warm: '#9B5CFF',
  sun: '#FCD93D', sky: '#3FB8DE', card: '#FFFDF9',
  shadow: '2px 2px 0 rgba(54,33,92,0.16)',
  shadowStrong: '4px 4px 0 rgba(54,33,92,0.20)',
};

const dot = (bg) => ({ width: 10, height: 10, borderRadius: 999, background: bg, border: `1.5px solid ${C.ink}` });
const vt = (size, color, extra = {}) => ({ fontFamily: 'VT323, monospace', fontSize: size, color, textTransform: 'uppercase', letterSpacing: '0.05em', ...extra });
const btn = (bg, color, extra = {}) => ({
  border: `2px solid ${C.ink}`, borderRadius: 8, boxShadow: C.shadow,
  fontFamily: 'Inter Tight, sans-serif', fontWeight: 600, fontSize: '0.78rem',
  padding: '8px 12px', cursor: 'pointer', background: bg, color, ...extra,
});

// deterministic small tilt per strip so the wall looks hand-pinned but stable
function tiltFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 9) - 4) * 0.9; // -3.6deg … +3.6deg
}
const PIN_COLORS = ['#FF5FB0', '#FCD93D', '#9B5CFF', '#3FB8DE'];

export default function PhotoBooth({ hidden = false }) {
  const [userId, setUserId] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | live | shooting | printing
  const [count, setCount] = useState(null);   // 3,2,1 overlay
  const [shotNum, setShotNum] = useState(0);  // 1..3 while shooting
  const [flash, setFlash] = useState(false);
  const [mono, setMono] = useState(false);
  const [strips, setStrips] = useState([]);   // {id, path, taken_at, url}
  const [freshId, setFreshId] = useState(null); // strip that gets the print animation
  const [lightbox, setLightbox] = useState(null); // strip object
  const [err, setErr] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cancelRef = useRef(false);

  // ---------- floating window: drag anywhere, pinned to the page ----------
  // Position is per-device (localStorage): x as % of page width, y in page px.
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ xp: 72, y: 340 });
  const [minimized, setMinimized] = useState(false);
  const winDragRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = JSON.parse(localStorage.getItem('align_booth_win') || 'null');
      if (saved && typeof saved.xp === 'number') {
        setPos({
          xp: Math.min(96, Math.max(0, saved.xp)),
          y: Math.max(60, saved.y || 340),
        });
        setMinimized(!!saved.min);
      }
    } catch {}
  }, []);

  const saveWin = (next) => {
    try { localStorage.setItem('align_booth_win', JSON.stringify(next)); } catch {}
  };

  const onBarPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    winDragRef.current = { startX: e.clientX, startY: e.clientY, origXp: pos.xp, origY: pos.y };
  };
  const onBarPointerMove = (e) => {
    const d = winDragRef.current;
    if (!d) return;
    const xp = Math.min(96, Math.max(-30, d.origXp + ((e.clientX - d.startX) / window.innerWidth) * 100));
    const y = Math.max(60, d.origY + (e.clientY - d.startY));
    setPos({ xp, y });
  };
  const onBarPointerUp = () => {
    if (!winDragRef.current) return;
    winDragRef.current = null;
    setPos(p => { saveWin({ ...p, min: minimized }); return p; });
  };
  const toggleMin = () => {
    setMinimized(m => { saveWin({ ...pos, min: !m }); return !m; });
  };

  // ---------- data ----------
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  const loadStrips = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: rows } = await supabase
      .from('photobooth_strips')
      .select('id, path, taken_at')
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(60);
    if (!rows?.length) { setStrips([]); return; }
    const { data: signed } = await supabase.storage
      .from('photobooth')
      .createSignedUrls(rows.map(r => r.path), 60 * 60);
    const urlByPath = {};
    (signed || []).forEach(s => { if (s?.signedUrl) urlByPath[s.path] = s.signedUrl; });
    setStrips(rows.map(r => ({ ...r, url: urlByPath[r.path] })).filter(r => r.url));
  }, [userId]);

  useEffect(() => { loadStrips(); }, [loadStrips]);

  // ---------- camera ----------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => () => { cancelRef.current = true; stopCamera(); }, [stopCamera]);

  // When the dock hides the booth, make sure the camera is released.
  useEffect(() => {
    if (hidden) {
      stopCamera();
      setStage('idle');
      setCount(null);
      setShotNum(0);
      setFlash(false);
    }
  }, [hidden, stopCamera]);

  const openBooth = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage('live');
    } catch (e) {
      setErr(e?.name === 'NotAllowedError'
        ? 'Camera permission was blocked — allow it in your browser settings and try again.'
        : `Couldn't open the camera: ${e?.message || e}`);
    }
  };

  // Attach the stream AFTER the <video> element exists. Setting srcObject in
  // openBooth raced React's render (the element wasn't mounted yet), which
  // left the viewfinder black.
  useEffect(() => {
    if ((stage === 'live' || stage === 'shooting') && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stage]);

  const closeBooth = () => { stopCamera(); setStage('idle'); setCount(null); setShotNum(0); };

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const captureFrame = () => {
    const video = videoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.translate(w, 0); ctx.scale(-1, 1); // mirror, like the preview
    ctx.drawImage(video, 0, 0, w, h);
    return c;
  };

  // crop-cover a source canvas into a 4:3 frame on the strip
  const drawCover = (ctx, src, dx, dy, dw, dh) => {
    const sRatio = src.width / src.height;
    const dRatio = dw / dh;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;
    if (sRatio > dRatio) { sw = src.height * dRatio; sx = (src.width - sw) / 2; }
    else { sh = src.width / dRatio; sy = (src.height - sh) / 2; }
    ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  };

  const composeStrip = (frames) => {
    const W = 360, FW = 320, FH = 240, M = 20, GAP = 18, FOOT = 64;
    const H = M + 3 * FH + 2 * GAP + FOOT;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    // paper
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    // frames with a vintage wash
    frames.forEach((f, i) => {
      const y = M + i * (FH + GAP);
      ctx.save();
      ctx.filter = mono
        ? 'grayscale(1) contrast(1.12) brightness(1.04)'
        : 'sepia(0.16) contrast(1.07) saturate(1.16) brightness(1.02)';
      drawCover(ctx, f, M, y, FW, FH);
      ctx.restore();
      // thin pink frame line
      ctx.strokeStyle = '#FFB3DE'; ctx.lineWidth = 3;
      ctx.strokeRect(M + 1.5, y + 1.5, FW - 3, FH - 3);
    });
    // film grain, lightly
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
    // date stamp footer
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `align \u2726 ${p(d.getMonth() + 1)}.${p(d.getDate())}.${String(d.getFullYear()).slice(2)}`;
    ctx.fillStyle = C.ink2;
    ctx.font = '26px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(stamp, W / 2, H - 26);
    return c;
  };

  const shoot = async () => {
    if (stage !== 'live' || !videoRef.current) return;
    setStage('shooting');
    cancelRef.current = false;
    const frames = [];
    try {
      for (let s = 1; s <= 3; s++) {
        setShotNum(s);
        for (const n of [3, 2, 1]) {
          if (cancelRef.current) return;
          setCount(n);
          await wait(900);
        }
        setCount(null);
        setFlash(true);
        await wait(120);
        frames.push(captureFrame());
        await wait(140);
        setFlash(false);
        await wait(600);
      }
      setStage('printing');
      stopCamera();
      const stripCanvas = composeStrip(frames);
      const blob = await new Promise(res => stripCanvas.toBlob(res, 'image/jpeg', 0.88));
      const supabase = createClient();
      const path = `${userId}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now())}.jpg`;
      const { error: upErr } = await supabase.storage.from('photobooth').upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: row, error: insErr } = await supabase
        .from('photobooth_strips')
        .insert({ user_id: userId, path })
        .select('id, path, taken_at')
        .single();
      if (insErr) throw insErr;
      const { data: signed } = await supabase.storage.from('photobooth').createSignedUrl(path, 60 * 60);
      setFreshId(row.id);
      setStrips(prev => [{ ...row, url: signed?.signedUrl }, ...prev]);
      setStage('idle');
      setShotNum(0);
      setTimeout(() => setFreshId(null), 2200);
    } catch (e) {
      console.error('[PhotoBooth]', e);
      setErr(e?.message || 'Something jammed the printer — try again.');
      stopCamera();
      setStage('idle');
      setShotNum(0);
      setCount(null);
      setFlash(false);
    }
  };

  const deleteStrip = async (strip) => {
    const supabase = createClient();
    await supabase.storage.from('photobooth').remove([strip.path]);
    await supabase.from('photobooth_strips').delete().eq('id', strip.id);
    setStrips(prev => prev.filter(s => s.id !== strip.id));
    setLightbox(null);
  };

  if (!userId || !mounted || hidden) return null;

  return createPortal(
    <div style={{ position: 'absolute', left: `${pos.xp}%`, top: pos.y, zIndex: 34, width: 'min(380px, calc(100vw - 20px))', background: C.card, border: `2px solid ${C.ink}`, borderRadius: 12, boxShadow: C.shadowStrong, overflow: 'hidden' }}>
      <style>{`
        @keyframes pbPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes pbPrint { from{ transform: translateY(-115%);} to{ transform: translateY(0);} }
        @keyframes pbPop { 0%{transform:scale(2.2);opacity:0} 60%{transform:scale(0.95);opacity:1} 100%{transform:scale(1)} }
        .pbStripWrap { overflow: hidden; }
        .pbFresh { animation: pbPrint 1.6s steps(14); }
        .pbCount { animation: pbPop .85s ease-out; }
      `}</style>

      {/* title bar — drag me */}
      <div onPointerDown={onBarPointerDown} onPointerMove={onBarPointerMove} onPointerUp={onBarPointerUp}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', background: C.sky, borderBottom: minimized ? 'none' : `2px solid ${C.ink}`, cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
        <span style={{ display: 'inline-flex', gap: 5 }}><span style={dot('#FF6FB5')} /><span style={dot(C.sun)} /></span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...vt('1.12rem', C.ink) }}>Photobooth.exe</span>
        {stage === 'live' || stage === 'shooting'
          ? <span style={{ ...vt('0.95rem', '#C0392B'), animation: 'pbPulse 1.2s infinite' }}>●REC</span>
          : <span style={vt('0.95rem', C.ink2)}>{strips.length} strip{strips.length === 1 ? '' : 's'}</span>}
        <button onClick={toggleMin} onPointerDown={(e) => e.stopPropagation()} title={minimized ? 'Expand' : 'Minimize'}
          style={{ background: 'none', border: `1.5px solid ${C.ink}`, borderRadius: 6, width: 20, height: 20, lineHeight: '15px', cursor: 'pointer', color: C.ink, fontFamily: 'VT323, monospace', fontSize: 14, padding: 0 }}>
          {minimized ? '+' : '−'}
        </button>
      </div>

      {!minimized && (

      <div style={{ padding: '12px 14px calc(14px + env(safe-area-inset-bottom))' }}>
        {/* ---------- viewfinder / start ---------- */}
        {stage === 'idle' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: strips.length ? 12 : 0 }}>
            <button onClick={openBooth} style={btn(C.accent, '#fff', { flex: 1, minWidth: 160 })}>★ open the booth</button>
            {err && <p style={{ width: '100%', fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: '#C0392B', margin: 0 }}>{err}</p>}
          </div>
        )}

        {(stage === 'live' || stage === 'shooting' || stage === 'printing') && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative', border: `2px solid ${C.ink}`, borderRadius: 8, overflow: 'hidden', background: '#14102A', aspectRatio: '4 / 3' }}>
              <video ref={videoRef} muted playsInline autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: mono ? 'grayscale(1) contrast(1.1)' : 'none', display: stage === 'printing' ? 'none' : 'block' }} />
              {/* scanlines */}
              {stage !== 'printing' && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px)' }} />
              )}
              {stage !== 'printing' && (
                <div style={{ position: 'absolute', top: 8, left: 10, ...vt('0.95rem', C.accent), animation: 'pbPulse 1.2s infinite' }}>● LIVE</div>
              )}
              {count !== null && (
                <div key={count} className="pbCount" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'VT323, monospace', fontSize: '5.5rem', color: C.sun, textShadow: `4px 4px 0 ${C.ink}` }}>{count}</div>
              )}
              {stage === 'shooting' && (
                <div style={{ position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', ...vt('0.95rem', '#fff') }}>shot {shotNum} of 3 — smile!</div>
              )}
              {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />}
              {stage === 'printing' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div style={{ ...vt('1.6rem', C.sun), animation: 'pbPulse 0.7s infinite' }}>printing…</div>
                  <div style={vt('0.95rem', '#B9A8DC')}>do not pull the strip</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {stage === 'live' && (
                <>
                  <button onClick={shoot} style={btn(C.accent, '#fff', { flex: 1 })}>★ start — 3 shots</button>
                  <button onClick={() => setMono(m => !m)} style={btn(mono ? C.ink : '#fff', mono ? '#fff' : C.ink)}>✦ mono</button>
                  <button onClick={closeBooth} style={btn('#fff', C.ink3, { borderColor: C.border, boxShadow: 'none' })}>close</button>
                </>
              )}
            </div>
            {/* print slot */}
            <div style={{ marginTop: 10, borderTop: `2px dashed ${C.border}`, paddingTop: 5, textAlign: 'center', ...vt('0.92rem', C.ink3) }}>▼ prints drop below ▼</div>
          </div>
        )}

        {/* ---------- THE WALL ---------- */}
        {strips.length > 0 ? (
          <div>
            <div style={{ ...vt('1rem', C.ink2), marginBottom: 10 }}>the wall ✦ look how cute you are</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {strips.map((s, i) => (
                <div key={s.id} className="pbStripWrap" style={{ paddingTop: 6 }}>
                  <div className={s.id === freshId ? 'pbFresh' : ''}
                    onClick={() => setLightbox(s)}
                    style={{ position: 'relative', transform: `rotate(${tiltFor(s.id)}deg)`, cursor: 'pointer' }}>
                    <span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 9, height: 9, borderRadius: 999, background: PIN_COLORS[i % PIN_COLORS.length], border: `1.5px solid ${C.ink}`, zIndex: 2 }} />
                    <img src={s.url} alt={`Photo strip from ${new Date(s.taken_at).toLocaleDateString()}`}
                      style={{ width: 88, display: 'block', border: `2px solid ${C.ink}`, borderRadius: 4, boxShadow: C.shadow, background: '#fff' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : stage === 'idle' && (
          <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.78rem', color: C.ink3, margin: '4px 0 0' }}>
            No strips yet — open the booth and take your first three.
          </p>
        )}
      </div>
      )}

      {/* ---------- LIGHTBOX ---------- */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(54,33,92,0.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, border: `2px solid ${C.ink}`, borderRadius: 12, boxShadow: C.shadowStrong, padding: 14, maxHeight: '90vh', overflowY: 'auto', textAlign: 'center' }}>
            <img src={lightbox.url} alt="Photo strip" style={{ maxHeight: '64vh', width: 'auto', display: 'block', margin: '0 auto', border: `2px solid ${C.ink}`, borderRadius: 4 }} />
            <div style={{ ...vt('0.95rem', C.ink2), margin: '10px 0' }}>
              {new Date(lightbox.taken_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={lightbox.url} download={`align-strip-${lightbox.id}.jpg`} target="_blank" rel="noopener noreferrer" style={{ ...btn(C.warm, '#fff'), textDecoration: 'none', display: 'inline-block' }}>download</a>
              <button onClick={() => deleteStrip(lightbox)} style={btn('#fff', '#C0392B', { borderColor: '#C0392B' })}>delete</button>
              <button onClick={() => setLightbox(null)} style={btn('#fff', C.ink)}>close</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
