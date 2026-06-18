'use client';

// components/DeskPet.jsx
// A little pixel companion that lives on your desktop. It bobs gently, blinks,
// and reacts to your momentum (streak) — happier when you're on a roll, sleepy
// when things are quiet. Tap to pet it: it wiggles and floats a heart. Never
// guilt-trips, never needs anything. Pure encouragement. Draggable; position
// persists. Toggle from the dock.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '@/lib/sfx';

const C = {
  ink: '#36215C', accent: '#FF5FB0', sun: '#FCD93D', warm: '#9B5CFF',
  body: '#FF8FCB', bodyDark: '#FF5FB0', belly: '#FFE3F1',
};

// 12x12 pixel sprite. 0=empty,1=outline,2=body,3=belly,4=cheek
const FRAMES = {
  open: [
    '000011110000',
    '000122221000',
    '001222222100',
    '012222222210',
    '012202202210',
    '012202202210',
    '012222222210',
    '012244442210',
    '012233332210',
    '001223332100',
    '000122221000',
    '000011110000',
  ],
  closed: [
    '000011110000',
    '000122221000',
    '001222222100',
    '012222222210',
    '012222222210',
    '011122221110',
    '012222222210',
    '012244442210',
    '012233332210',
    '001223332100',
    '000122221000',
    '000011110000',
  ],
};

const PX = { 0: null, 1: C.ink, 2: C.body, 3: C.belly, 4: '#FF5FB0' };

function Sprite({ frame, happy }) {
  const grid = FRAMES[frame];
  return (
    <svg width={48} height={48} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" style={{ display: 'block' }}>
      {grid.flatMap((row, y) =>
        row.split('').map((ch, x) => {
          const v = +ch;
          let fill = PX[v];
          if (v === 2 && happy) fill = C.bodyDark;
          return fill ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} /> : null;
        })
      )}
    </svg>
  );
}

export default function DeskPet({ hidden = false, streak = 0 }) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ xp: 86, y: 540 });
  const [frame, setFrame] = useState('open');
  const [petting, setPetting] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [bubble, setBubble] = useState('');
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const blinkTimer = useRef(null);

  const mood = streak >= 3 ? 'happy' : streak >= 1 ? 'content' : 'sleepy';

  useEffect(() => {
    setMounted(true);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    try {
      const saved = JSON.parse(localStorage.getItem('align_pet_win') || 'null');
      if (saved && typeof saved.xp === 'number') {
        const maxXp = vw < 640 ? 78 : 92;
        setPos({ xp: Math.min(maxXp, Math.max(2, saved.xp)), y: Math.max(80, saved.y || 540) });
      } else if (vw < 640) {
        setPos({ xp: 74, y: 520 });
      }
    } catch {}
  }, []);

  // blink loop (sleepy = eyes closed longer)
  useEffect(() => {
    if (hidden) return;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const closedMs = mood === 'sleepy' ? 1400 : 160;
      const openMs = mood === 'sleepy' ? 2200 : 2600 + Math.random() * 2500;
      setFrame('closed');
      setTimeout(() => { if (alive) setFrame('open'); }, closedMs);
      blinkTimer.current = setTimeout(loop, openMs + closedMs);
    };
    loop();
    return () => { alive = false; clearTimeout(blinkTimer.current); };
  }, [hidden, mood]);

  const savePos = (next) => { try { localStorage.setItem('align_pet_win', JSON.stringify(next)); } catch {} };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    movedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origXp: pos.xp, origY: pos.y };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    const vw = window.innerWidth;
    const maxXp = vw < 640 ? 80 : 94;
    const xp = Math.min(maxXp, Math.max(1, d.origXp + (dx / vw) * 100));
    const y = Math.max(70, d.origY + dy);
    setPos({ xp, y });
  };
  const onPointerUp = () => {
    if (dragRef.current) { savePos(pos); dragRef.current = null; }
  };

  const pet = useCallback(() => {
    if (movedRef.current) return; // was a drag, not a tap
    const PRAISE = [
      'hi!', 'you got this \u2726', 'proud of you', 'love that', 'yay!', '\u2661', 'keep going',
      streak >= 3 ? `${streak} days! wow` : 'one thing at a time',
    ];
    setPetting(true);
    sfx.play('sparkle');
    const id = Date.now();
    setHearts(h => [...h, { id, dx: (Math.random() - 0.5) * 30 }]);
    setTimeout(() => setHearts(h => h.filter(x => x.id !== id)), 1100);
    setBubble(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    setTimeout(() => setBubble(''), 1600);
    setTimeout(() => setPetting(false), 500);
  }, [streak]);

  if (!mounted || hidden) return null;

  return createPortal(
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={pet}
      style={{
        position: 'absolute', left: `${pos.xp}%`, top: pos.y, zIndex: 32,
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: 64,
      }}
      title="your align buddy — tap to pet, drag to move"
    >
      <style>{`
        @keyframes petBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes petWiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
        @keyframes petHeart { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(-40px) scale(1.1); opacity: 0; } }
        @keyframes petBubble { 0% { transform: translateY(4px) scale(0.9); opacity: 0; } 15% { transform: translateY(0) scale(1); opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      {hearts.map(h => (
        <div key={h.id} style={{ position: 'absolute', top: 6, left: '50%', marginLeft: h.dx, color: C.accent, fontSize: 18, animation: 'petHeart 1.1s ease-out forwards', pointerEvents: 'none' }}>♥</div>
      ))}

      {bubble && (
        <div style={{
          position: 'absolute', top: -26, whiteSpace: 'nowrap',
          background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 8,
          padding: '2px 8px', fontFamily: 'VT323, monospace', fontSize: 14, color: C.ink,
          boxShadow: `2px 2px 0 rgba(54,33,92,0.18)`, animation: 'petBubble 1.6s ease-out forwards', pointerEvents: 'none',
        }}>{bubble}</div>
      )}

      <div style={{
        animation: petting ? 'petWiggle 0.5s ease-in-out' : `petBob ${mood === 'sleepy' ? '4.5s' : '3s'} ease-in-out infinite`,
        filter: 'drop-shadow(2px 3px 2px rgba(54,33,92,0.25))',
      }}>
        <Sprite frame={frame} happy={mood === 'happy'} />
      </div>

      <div style={{ width: 30, height: 5, borderRadius: '50%', background: 'rgba(54,33,92,0.14)', marginTop: -2 }} />
      {mood === 'sleepy' && !petting && (
        <div style={{ position: 'absolute', top: 0, right: 2, fontFamily: 'VT323, monospace', fontSize: 13, color: C.warm, opacity: 0.7 }}>z</div>
      )}
    </div>,
    document.body
  );
}
