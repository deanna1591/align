'use client';

// components/StickerLayer.jsx
// STICKERS.EXE — a journaling layer of glossy Y2K stickers you can drag and
// pin anywhere on screen. Positions persist (as % of viewport, so a sticker
// in the corner stays in the corner on every device). All art is original.
//
// Interactions: ✦ button (bottom-left) opens the tray → tap a sticker to add
// it → drag to place. Tap a placed sticker to select: ✕ deletes, ↻ rotates.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

const INK = '#36215C';
const C = {
  ink: INK, ink2: '#6E5499', ink3: '#9F88C9', border: '#C9B8E6',
  accent: '#FF5FB0', warm: '#9B5CFF', sun: '#FCD93D', card: '#FFFDF9',
  shadow: '2px 2px 0 rgba(54,33,92,0.16)', shadowStrong: '4px 4px 0 rgba(54,33,92,0.20)',
};

// ---------- the sticker set (original Y2K art, die-cut style) ----------
// Each renders inside an svg with a white "cut" outline via paint-order.
const cut = { stroke: '#FFFFFF', strokeWidth: 3.5, strokeLinejoin: 'round', paintOrder: 'stroke' };
const cutThin = { ...cut, strokeWidth: 2.5 };

const STICKERS = {
  butterfly: { w: 64, vb: '0 0 32 28', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M15 14 C8 2 1 4 2 11 C3 17 10 17 15 14 Z" fill="#FF8AD0" {...cut} />
      <path d="M17 14 C24 2 31 4 30 11 C29 17 22 17 17 14 Z" fill="#FF8AD0" {...cut} />
      <path d="M15 15 C9 24 3 24 3 19 C3 15 10 14 15 15 Z" fill="#C79BFF" {...cut} />
      <path d="M17 15 C23 24 29 24 29 19 C29 15 22 14 17 15 Z" fill="#C79BFF" {...cut} />
      <ellipse cx="16" cy="14.5" rx="2" ry="6.5" fill={INK} />
      <circle cx="7" cy="9" r="1.6" fill="#fff" opacity=".75" />
      <circle cx="25" cy="9" r="1.6" fill="#fff" opacity=".75" />
    </g>
  )},
  flipphone: { w: 56, vb: '0 0 24 34', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="3" y="2" width="18" height="14" rx="3" fill="#FF8AD0" {...cut} />
      <rect x="6" y="5" width="12" height="8" rx="1.5" fill="#BDF1FF" />
      <rect x="3" y="17" width="18" height="14" rx="3" fill="#FF5FB0" {...cut} />
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <rect key={`${r}${c}`} x={6.4 + c * 4} y={19.5 + r * 3.4} width="3" height="2.4" rx="0.8" fill="#FFD6EE" />
      )))}
      <rect x="20" y="0" width="2" height="6" rx="1" fill={INK} />
      <rect x="7" y="6" width="4" height="2" rx="1" fill="#fff" opacity=".8" />
    </g>
  )},
  heart: { w: 56, vb: '0 0 28 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M14 24 C2 15 1 6 7 3.5 C11 2 14 5 14 7 C14 5 17 2 21 3.5 C27 6 26 15 14 24 Z" fill="#FF4FA0" {...cut} />
      <ellipse cx="9" cy="8" rx="3" ry="2" fill="#fff" opacity=".7" transform="rotate(-22 9 8)" />
    </g>
  )},
  star: { w: 56, vb: '0 0 30 29', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M15 1 L19 10.5 L29 11.3 L21.5 18 L23.8 28 L15 22.7 L6.2 28 L8.5 18 L1 11.3 L11 10.5 Z" fill="#FFD93D" {...cut} />
      <ellipse cx="11" cy="10" rx="3" ry="2" fill="#fff" opacity=".7" transform="rotate(-20 11 10)" />
    </g>
  )},
  sparkle: { w: 48, vb: '0 0 24 24', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M12 1 C13 7 15 9 23 12 C15 15 13 17 12 23 C11 17 9 15 1 12 C9 9 11 7 12 1 Z" fill="#C79BFF" {...cut} />
      <circle cx="12" cy="12" r="2" fill="#fff" opacity=".8" />
    </g>
  )},
  lips: { w: 60, vb: '0 0 32 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M3 8 C7 1 13 3 16 6 C19 3 25 1 29 8 C24 16 8 16 3 8 Z" fill="#FF3D8F" {...cut} />
      <path d="M3 8 C12 10 20 10 29 8 C24 16 8 16 3 8 Z" fill="#E0246F" />
      <ellipse cx="10" cy="6" rx="3" ry="1.4" fill="#fff" opacity=".65" transform="rotate(-10 10 6)" />
    </g>
  )},
  cherry: { w: 52, vb: '0 0 26 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M8 19 C13 9 16 5 22 2" fill="none" stroke="#5BAF4E" strokeWidth="2.5" strokeLinecap="round" {...{ paintOrder: 'stroke' }} style={{ stroke: '#5BAF4E' }} />
      <path d="M18 18 C19 10 20 6 22 2" fill="none" stroke="#5BAF4E" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 2 C19 1 16 2 15 4 C19 4 21 3 22 2 Z" fill="#7CCB6B" {...cutThin} />
      <circle cx="8" cy="23" r="6" fill="#FF3D6E" {...cut} />
      <circle cx="19" cy="22" r="6" fill="#FF5FB0" {...cut} />
      <circle cx="6" cy="21" r="1.7" fill="#fff" opacity=".7" />
      <circle cx="17" cy="20" r="1.7" fill="#fff" opacity=".7" />
    </g>
  )},
  smiley: { w: 52, vb: '0 0 26 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <circle cx="13" cy="13" r="11.5" fill="#FFD93D" {...cut} />
      <circle cx="9" cy="10.5" r="1.7" fill={INK} />
      <circle cx="17" cy="10.5" r="1.7" fill={INK} />
      <path d="M8 15.5 C10.5 19 15.5 19 18 15.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="9" cy="7" rx="3" ry="1.6" fill="#fff" opacity=".65" transform="rotate(-18 9 7)" />
    </g>
  )},
  cd: { w: 54, vb: '0 0 28 28', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <circle cx="14" cy="14" r="12.5" fill="#DCE9F7" {...cut} />
      <path d="M14 1.5 A12.5 12.5 0 0 1 26.5 14 L20 14 A6 6 0 0 0 14 8 Z" fill="#BFE3FF" opacity=".9" />
      <path d="M1.5 14 A12.5 12.5 0 0 0 14 26.5 L14 20 A6 6 0 0 1 8 14 Z" fill="#FFC7E8" opacity=".9" />
      <path d="M5 6 A12.5 12.5 0 0 1 14 1.5 L14 8 A6 6 0 0 0 9.5 10 Z" fill="#D9C9FF" opacity=".9" />
      <circle cx="14" cy="14" r="4.5" fill="#fff" stroke={INK} strokeWidth="1" />
      <circle cx="14" cy="14" r="1.8" fill="#F4EFFE" stroke={INK} strokeWidth="1" />
    </g>
  )},
  crown: { w: 60, vb: '0 0 32 24', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M3 19 L4.5 7 L11 12 L16 3 L21 12 L27.5 7 L29 19 Z" fill="#FFD93D" {...cut} />
      <rect x="3" y="19" width="26" height="3.5" rx="1.5" fill="#FFC53D" {...cutThin} />
      <circle cx="9.5" cy="15.5" r="1.7" fill="#FF5FB0" />
      <circle cx="16" cy="14.5" r="1.9" fill="#9B5CFF" />
      <circle cx="22.5" cy="15.5" r="1.7" fill="#3FB8DE" />
      <circle cx="16" cy="3" r="1.6" fill="#FF5FB0" {...cutThin} />
    </g>
  )},
  flame: { w: 50, vb: '0 0 22 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M11 1 C15 7 20 10 20 18 A9 9 0 0 1 2 18 C2 13 5 11 6 7 C8 10 10 10 11 1 Z" fill="#FF7A3D" {...cut} />
      <path d="M11 12 C13 15 15 16 15 20 A4.5 4.5 0 0 1 6.5 20 C6.5 17 9 16 11 12 Z" fill="#FFD93D" />
    </g>
  )},
  bow: { w: 58, vb: '0 0 32 20', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M14 10 C8 3 2 3 2 9 C2 15 8 16 14 11 Z" fill="#FF8AD0" {...cut} />
      <path d="M18 10 C24 3 30 3 30 9 C30 15 24 16 18 11 Z" fill="#FF8AD0" {...cut} />
      <path d="M12 11 L9 19 L13 18 Z" fill="#FF5FB0" {...cutThin} />
      <path d="M20 11 L23 19 L19 18 Z" fill="#FF5FB0" {...cutThin} />
      <circle cx="16" cy="10" r="3.4" fill="#FF5FB0" {...cut} />
      <circle cx="6" cy="7.5" r="1.4" fill="#fff" opacity=".7" />
    </g>
  )},
  xoxo: { w: 78, vb: '0 0 44 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="41" height="15" rx="7.5" fill="#FF5FB0" {...cut} />
      <text x="22" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="12" fill="#fff" letterSpacing="1.5">XOXO</text>
    </g>
  )},
  omg: { w: 66, vb: '0 0 36 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M18 1 L21.5 7 L28 4.5 L27 11 L34 12.5 L28.5 17 L33 22.5 L26 22.5 L26.5 29 L18 25 L9.5 29 L10 22.5 L3 22.5 L7.5 17 L2 12.5 L9 11 L8 4.5 L14.5 7 Z" fill="#FFD93D" {...cut} />
      <text x="18" y="19.5" textAnchor="middle" fontFamily="VT323, monospace" fontSize="10.5" fill={INK} fontWeight="bold">OMG!</text>
    </g>
  )},
  drama: { w: 86, vb: '0 0 50 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="47" height="15" rx="4" fill="#9B5CFF" {...cut} />
      <text x="25" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="11" fill="#fff" letterSpacing="1">DRAMA QUEEN</text>
    </g>
  )},
  socute: { w: 74, vb: '0 0 42 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="39" height="15" rx="7.5" fill="#BDF1FF" {...cut} />
      <text x="19" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="11" fill={INK} letterSpacing="1">SO CUTE</text>
      <path d="M35 6 C33.8 4.6 31.8 5.4 32 7 C32.2 8.6 35 10 35 10 C35 10 37.8 8.6 38 7 C38.2 5.4 36.2 4.6 35 6 Z" fill="#FF5FB0" />
    </g>
  )},
  itgirl: { w: 70, vb: '0 0 40 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="37" height="15" rx="7.5" fill="#FFD6EE" {...cut} />
      <text x="20" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="11" fill="#E0246F" letterSpacing="1.2">IT GIRL ✦</text>
    </g>
  )},
};
const STICKER_KEYS = Object.keys(STICKERS);

function StickerArt({ kind, scale = 1 }) {
  const s = STICKERS[kind];
  if (!s) return null;
  const [, , vw, vh] = s.vb.split(' ').map(Number);
  const w = s.w * scale;
  return (
    <svg width={w} height={(w * vh) / vw} viewBox={s.vb} style={{ display: 'block', overflow: 'visible' }}>
      {s.el}
    </svg>
  );
}

// ---------- the layer ----------
export default function StickerLayer() {
  const [userId, setUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const dragRef = useRef(null); // {id, startX, startY, origXPct, origYPct, moved}

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase.from('stickers').select('id, kind, x_pct, y_pct, rotation, scale')
      .eq('user_id', userId).order('created_at')
      .then(({ data }) => setItems(data || []));
  }, [userId]);

  // deselect when tapping anywhere else
  useEffect(() => {
    if (!selected) return;
    const off = (e) => {
      if (!e.target.closest?.('[data-sticker]')) setSelected(null);
    };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [selected]);

  const addSticker = async (kind) => {
    if (!userId) return;
    const supabase = createClient();
    const draft = {
      user_id: userId, kind,
      x_pct: 44 + Math.random() * 12,
      y_pct: 30 + Math.random() * 16,
      rotation: Math.round(Math.random() * 24 - 12),
      scale: 1,
    };
    setTrayOpen(false);
    const { data, error } = await supabase.from('stickers').insert(draft).select('id, kind, x_pct, y_pct, rotation, scale').single();
    if (!error && data) { setItems(prev => [...prev, data]); setSelected(data.id); }
  };

  const persist = useCallback((id, patch) => {
    const supabase = createClient();
    supabase.from('stickers').update(patch).eq('id', id).then(() => {});
  }, []);

  const onPointerDown = (e, st) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { id: st.id, startX: e.clientX, startY: e.clientY, origXPct: st.x_pct, origYPct: st.y_pct, moved: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (!d.moved) return;
    const x = Math.min(98, Math.max(1, d.origXPct + (dx / window.innerWidth) * 100));
    const y = Math.min(98, Math.max(1, d.origYPct + (dy / window.innerHeight) * 100));
    setItems(prev => prev.map(s => (s.id === d.id ? { ...s, x_pct: x, y_pct: y } : s)));
  };
  const onPointerUp = (e, st) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== st.id) return;
    if (d.moved) {
      const cur = items.find(s => s.id === st.id);
      const moved = {
        x_pct: Math.min(98, Math.max(1, d.origXPct + ((e.clientX - d.startX) / window.innerWidth) * 100)),
        y_pct: Math.min(98, Math.max(1, d.origYPct + ((e.clientY - d.startY) / window.innerHeight) * 100)),
      };
      persist(st.id, cur ? { x_pct: cur.x_pct, y_pct: cur.y_pct } : moved);
    } else {
      setSelected(sel => (sel === st.id ? null : st.id));
    }
  };

  const rotate = (st) => {
    const r = ((st.rotation || 0) + 15) % 360;
    setItems(prev => prev.map(s => (s.id === st.id ? { ...s, rotation: r } : s)));
    persist(st.id, { rotation: r });
  };
  const remove = async (st) => {
    setItems(prev => prev.filter(s => s.id !== st.id));
    setSelected(null);
    const supabase = createClient();
    await supabase.from('stickers').delete().eq('id', st.id);
  };

  if (!userId) return null;

  const miniBtn = {
    width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${C.ink}`,
    background: '#fff', color: C.ink, fontSize: 12, lineHeight: '19px',
    textAlign: 'center', cursor: 'pointer', boxShadow: C.shadow, padding: 0,
  };

  return (
    <>
      {/* placed stickers — float over everything except drawers/modals */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 35 }}>
        {items.map(st => (
          <div key={st.id} data-sticker
            onPointerDown={(e) => onPointerDown(e, st)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e, st)}
            style={{
              position: 'absolute', left: `${st.x_pct}%`, top: `${st.y_pct}%`,
              transform: `translate(-50%, -50%) rotate(${st.rotation || 0}deg)`,
              pointerEvents: 'auto', touchAction: 'none', userSelect: 'none',
              cursor: 'grab',
              outline: selected === st.id ? `2px dashed ${C.accent}` : 'none',
              outlineOffset: 4, borderRadius: 6,
            }}>
            <StickerArt kind={st.kind} scale={st.scale || 1} />
            {selected === st.id && (
              <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                <button style={miniBtn} title="Rotate" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); rotate(st); }}>↻</button>
                <button style={{ ...miniBtn, color: '#C0392B', borderColor: '#C0392B' }} title="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(st); }}>✕</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* tray button — bottom left */}
      <button onClick={() => setTrayOpen(o => !o)} title="Stickers"
        style={{
          position: 'fixed', left: 14, bottom: 'calc(14px + env(safe-area-inset-bottom))', zIndex: 36,
          width: 46, height: 46, borderRadius: 999, background: C.sun, color: C.ink,
          border: `2px solid ${C.ink}`, boxShadow: C.shadowStrong, cursor: 'pointer',
          fontFamily: 'VT323, monospace', fontSize: 22, lineHeight: '40px',
        }}>✦</button>

      {/* the tray */}
      {trayOpen && (
        <div style={{
          position: 'fixed', left: 12, bottom: 'calc(68px + env(safe-area-inset-bottom))', zIndex: 60,
          width: 'min(340px, 92vw)', background: C.card, border: `2px solid ${C.ink}`,
          borderRadius: 12, boxShadow: C.shadowStrong, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', background: '#FFB3DE', borderBottom: `2px solid ${C.ink}` }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FF6FB5', border: `1.5px solid ${C.ink}` }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: C.sun, border: `1.5px solid ${C.ink}` }} />
            </span>
            <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.ink }}>Stickers.exe</span>
            <button onClick={() => setTrayOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: C.ink2 }}>✕</button>
          </div>
          <div style={{ padding: 12, maxHeight: '46vh', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {STICKER_KEYS.map(k => (
                <button key={k} onClick={() => addSticker(k)} title={k}
                  style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '10px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64 }}>
                  <StickerArt kind={k} scale={0.82} />
                </button>
              ))}
            </div>
            <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.68rem', color: C.ink3, margin: '10px 0 0' }}>
              tap to add · drag to place · tap a placed sticker to rotate or remove
            </p>
          </div>
        </div>
      )}
    </>
  );
}
