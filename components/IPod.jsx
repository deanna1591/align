'use client';

// components/IPod.jsx
// TAPE.EXE — a draggable, pinnable cassette-tape music player for the planner.
// Paste a Spotify playlist link into its screen once; it's remembered. Plays
// via Spotify's official embed (full tracks when you're logged into Spotify
// in this browser, previews otherwise). Transport bar: REW = restart / back
// 15s, PLAY = play-pause, FF = forward 15s, LIST = playlist <-> mini view.
// Drag the body anywhere; position persists per device (like the photobooth).
//
// NOTE: Designed as a retro cassette deck — deliberately NOT resembling any
// hardware music player product. All controls are labeled rectangular buttons.

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const INK = '#36215C';
const SHADOW = '4px 4px 0 rgba(54,33,92,0.20)';

function parsePlaylist(link) {
  // accepts: full open.spotify.com URLs (playlist/album/track) or bare URI
  const m = String(link || '').match(/open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  const u = String(link || '').match(/^spotify:(playlist|album|track):[A-Za-z0-9]+$/);
  return u ? link : null;
}

export default function IPod({ hidden = false }) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ xp: 4, y: 420 });
  const [minimized, setMinimized] = useState(false);
  const [uri, setUri] = useState(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [menuView, setMenuView] = useState(true); // tall playlist view vs mini
  const [playing, setPlaying] = useState(false);
  const [posSec, setPosSec] = useState(0);
  const dragRef = useRef(null);
  const screenRef = useRef(null);
  const controllerRef = useRef(null);
  const apiRef = useRef(null);

  // ---------- mount: restore position + playlist ----------
  useEffect(() => {
    setMounted(true);
    try {
      const saved = JSON.parse(localStorage.getItem('align_ipod_win') || 'null');
      if (saved && typeof saved.xp === 'number') {
        setPos({ xp: Math.min(96, Math.max(-20, saved.xp)), y: Math.max(60, saved.y || 420) });
        setMinimized(!!saved.min);
      }
      const savedUri = localStorage.getItem('align_ipod_playlist');
      if (savedUri) setUri(savedUri);
    } catch {}
  }, []);

  const saveWin = (next) => {
    try { localStorage.setItem('align_ipod_win', JSON.stringify(next)); } catch {}
  };

  // ---------- Spotify iframe API ----------
  useEffect(() => {
    if (!uri || minimized) return;
    let cancelled = false;

    const init = (IFrameAPI) => {
      if (cancelled || !screenRef.current) return;
      controllerRef.current?.destroy?.();
      screenRef.current.innerHTML = '<div></div>';
      IFrameAPI.createController(
        screenRef.current.firstChild,
        { uri, width: '100%', height: '100%' },
        (controller) => {
          controllerRef.current = controller;
          controller.addListener('playback_update', (e) => {
            setPlaying(!e?.data?.isPaused);
            setPosSec((e?.data?.position || 0) / 1000);
          });
        }
      );
    };

    if (apiRef.current) { init(apiRef.current); return () => { cancelled = true; }; }

    window.onSpotifyIframeApiReady = (IFrameAPI) => { apiRef.current = IFrameAPI; init(IFrameAPI); };
    if (!document.getElementById('spotify-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'spotify-iframe-api';
      s.src = 'https://open.spotify.com/embed/iframe-api/v1';
      s.async = true;
      document.body.appendChild(s);
    }
    return () => { cancelled = true; };
  }, [uri, minimized, menuView]);

  // ---------- transport actions ----------
  const togglePlay = () => controllerRef.current?.togglePlay?.();
  const back = () => controllerRef.current?.seek?.(posSec > 5 ? Math.max(0, posSec - 15) : 0);
  const fwd = () => controllerRef.current?.seek?.(posSec + 15);
  const menu = () => setMenuView(v => !v);

  // ---------- dragging (body = handle) ----------
  const onPointerDown = (e) => {
    if (e.target.closest('[data-nodrag]')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origXp: pos.xp, origY: pos.y };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const xp = Math.min(96, Math.max(-20, d.origXp + ((e.clientX - d.startX) / window.innerWidth) * 100));
    const y = Math.max(60, d.origY + (e.clientY - d.startY));
    setPos({ xp, y });
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPos(p => { saveWin({ ...p, min: minimized }); return p; });
  };
  const toggleMin = () => setMinimized(m => { saveWin({ ...pos, min: !m }); return !m; });

  const setPlaylist = () => {
    const parsed = parsePlaylist(linkDraft.trim());
    if (!parsed) { setLinkDraft(''); return; }
    try { localStorage.setItem('align_ipod_playlist', parsed); } catch {}
    setUri(parsed);
  };
  const clearPlaylist = () => {
    try { localStorage.removeItem('align_ipod_playlist'); } catch {}
    controllerRef.current?.destroy?.();
    controllerRef.current = null;
    setUri(null);
    setPlaying(false);
  };

  if (!mounted) return null;

  // labeled rectangular transport button — clearly software UI, not a wheel
  const tBtn = {
    flex: 1,
    background: 'linear-gradient(180deg, #FFFFFF 0%, #ECEDF2 100%)',
    border: `2px solid ${INK}`,
    borderRadius: 7,
    cursor: 'pointer',
    color: INK,
    fontFamily: 'VT323, monospace',
    fontSize: 12,
    letterSpacing: '0.06em',
    lineHeight: '22px',
    padding: '4px 0',
    userSelect: 'none',
    textTransform: 'uppercase',
    boxShadow: '2px 2px 0 rgba(54,33,92,0.18)',
  };

  return createPortal(
    <div
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{
        position: 'absolute', left: `${pos.xp}%`, top: pos.y, zIndex: 33,
        display: hidden ? 'none' : undefined,
        width: minimized ? 120 : 'min(260px, calc(100vw - 24px))',
        background: 'linear-gradient(160deg, #FFFFFF 0%, #F2F3F6 70%, #E8EAEF 100%)',
        border: `2px solid ${INK}`, borderRadius: 14, boxShadow: SHADOW,
        padding: minimized ? '6px 10px' : '12px 12px 14px',
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
      }}>
      {/* top row: name + minimize */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: minimized ? 0 : 8 }}>
        <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '0.95rem', letterSpacing: '0.08em', color: '#A6ACB8', textTransform: 'uppercase' }}>
          {minimized ? (playing ? '♪ tape.exe' : 'tape.exe') : 'tape.exe'}
        </span>
        {minimized && playing && <span style={{ fontSize: 10, color: '#7BC47F', marginRight: 6 }}>▶</span>}
        <button data-nodrag onClick={toggleMin} title={minimized ? 'Expand' : 'Minimize'}
          style={{ background: 'none', border: `1.5px solid #C3C8D2`, borderRadius: 6, width: 20, height: 20, lineHeight: '15px', cursor: 'pointer', color: '#8A91A0', fontFamily: 'VT323, monospace', fontSize: 14, padding: 0 }}>
          {minimized ? '+' : '−'}
        </button>
      </div>

      {!minimized && (
        <>
          {/* SCREEN */}
          <div style={{ border: `2px solid ${INK}`, borderRadius: 8, overflow: 'hidden', background: '#0F1014', height: uri ? (menuView ? 300 : 84) : 150, position: 'relative' }}>
            {uri ? (
              <div data-nodrag ref={screenRef} style={{ width: '100%', height: '100%' }} />
            ) : (
              <div data-nodrag style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'VT323, monospace', fontSize: '0.95rem', color: '#7DD87F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>♪ load your music</div>
                <input
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setPlaylist()}
                  placeholder="paste Spotify playlist link"
                  style={{ width: '100%', fontSize: 16, padding: '7px 9px', borderRadius: 6, border: '1.5px solid #3A3D46', background: '#1A1C22', color: '#E8EAEF', fontFamily: 'Inter Tight, sans-serif', outline: 'none' }}
                />
                <button onClick={setPlaylist}
                  style={{ alignSelf: 'flex-start', background: '#7DD87F', color: '#0F1014', border: 'none', borderRadius: 6, fontFamily: 'Inter Tight, sans-serif', fontWeight: 700, fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}>
                  load ▸
                </button>
              </div>
            )}
          </div>

          {/* CASSETTE WINDOW — two spinning reels behind a clear window */}
          <div style={{
            marginTop: 14, border: `2px solid ${INK}`, borderRadius: 10,
            background: 'linear-gradient(160deg, #FBE3F1 0%, #F3D2E7 100%)',
            padding: '12px 14px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              textAlign: 'center', fontFamily: 'VT323, monospace', fontSize: 13,
              letterSpacing: '0.14em', color: INK, textTransform: 'uppercase',
              marginBottom: 10, opacity: 0.8,
            }}>
              {'\u2726 mixtape \u2726'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{
                  position: 'relative',
                  width: 46, height: 46, borderRadius: 999,
                  border: `2px solid ${INK}`, background: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: playing ? 'tapeSpin 2.6s linear infinite' : 'none',
                }}>
                  <div style={{ position: 'absolute', width: 2, height: 18, background: INK, opacity: 0.35 }} />
                  <div style={{ position: 'absolute', width: 2, height: 18, background: INK, opacity: 0.35, transform: 'rotate(60deg)' }} />
                  <div style={{ position: 'absolute', width: 2, height: 18, background: INK, opacity: 0.35, transform: 'rotate(120deg)' }} />
                  <div style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${INK}`, background: '#FBE3F1', zIndex: 1 }} />
                </div>
              ))}
            </div>
          </div>

          {/* TRANSPORT BAR — labeled rectangular buttons, no wheel */}
          <div data-nodrag style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button data-nodrag onClick={back} style={tBtn} title="Restart / back 15s">{'\u23EE rew'}</button>
            <button data-nodrag onClick={togglePlay} style={{ ...tBtn, flex: 1.5, background: 'linear-gradient(180deg, #FF8FCB 0%, #FF5FB0 100%)', color: '#FFFFFF' }} title="Play / pause">
              {playing ? '\u275A\u275A pause' : '\u25B6 play'}
            </button>
            <button data-nodrag onClick={fwd} style={tBtn} title="Forward 15s">{'ff \u23ED'}</button>
            <button data-nodrag onClick={menu} style={tBtn} title="Toggle playlist / mini view">list</button>
          </div>

          {uri && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button data-nodrag onClick={clearPlaylist}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: '#A6ACB8', textDecoration: 'underline' }}>
                change playlist
              </button>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes tapeSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>,
    document.body
  );
}
