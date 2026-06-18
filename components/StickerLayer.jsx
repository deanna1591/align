'use client';

// components/StickerLayer.jsx
// STICKERS.EXE — a journaling layer of glossy Y2K stickers you can drag and
// pin anywhere ON THE PAGE. Anchoring: x is stored as % of page width, y as
// pixels from the top of the document — so a sticker placed beside a section
// stays beside it when you scroll, like a real scrapbook. (The y_pct column
// holds pixels; the name is historical.) All art is original.
//
// Interactions: ✦ button (bottom-left) opens the tray → tap a sticker to add
// it → drag to place. Tap a placed sticker to select: ✕ deletes, ↻ rotates.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  butterfly: { w: 64, vb: '0 0 32 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M14 7 C13 4 11 2 9 2 M18 7 C19 4 21 2 23 2" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="2" r="1.2" fill={INK} /><circle cx="23" cy="2" r="1.2" fill={INK} />
      <path d="M15 16 C8 4 1 6 2 13 C3 19 10 19 15 16 Z" fill="#FF8AD0" {...cut} />
      <path d="M17 16 C24 4 31 6 30 13 C29 19 22 19 17 16 Z" fill="#FF8AD0" {...cut} />
      <path d="M15 17 C9 26 3 26 3 21 C3 17 10 16 15 17 Z" fill="#C79BFF" {...cut} />
      <path d="M17 17 C23 26 29 26 29 21 C29 17 22 16 17 17 Z" fill="#C79BFF" {...cut} />
      <circle cx="8" cy="12" r="1.8" fill="#FFD6EE" /><circle cx="24" cy="12" r="1.8" fill="#FFD6EE" />
      <circle cx="7" cy="21" r="1.3" fill="#EDE0FF" /><circle cx="25" cy="21" r="1.3" fill="#EDE0FF" />
      <ellipse cx="16" cy="16.5" rx="2" ry="6.5" fill={INK} />
      <ellipse cx="15.3" cy="13.5" rx="0.7" ry="1.6" fill="#6E5499" />
      <circle cx="7" cy="10.5" r="1.4" fill="#fff" opacity=".8" />
      <circle cx="25" cy="10.5" r="1.4" fill="#fff" opacity=".8" />
    </g>
  )},
  flipphone: { w: 56, vb: '0 0 24 34', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="3" y="2" width="18" height="14" rx="3" fill="#FF8AD0" {...cut} />
      <rect x="6" y="5" width="12" height="8" rx="1.5" fill="#BDF1FF" />
      <path d="M12 8.2 C11.3 7.3 10 7.8 10.1 8.8 C10.2 9.8 12 10.8 12 10.8 C12 10.8 13.8 9.8 13.9 8.8 C14 7.8 12.7 7.3 12 8.2 Z" fill="#FF5FB0" />
      <rect x="9" y="3.2" width="6" height="1" rx="0.5" fill="#E0246F" opacity=".6" />
      <rect x="3" y="15.4" width="18" height="1.6" fill="#E0246F" opacity=".5" />
      <rect x="3" y="17" width="18" height="14" rx="3" fill="#FF5FB0" {...cut} />
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <rect key={`${r}${c}`} x={6.4 + c * 4} y={19.5 + r * 3.4} width="3" height="2.4" rx="0.8" fill="#FFD6EE" />
      )))}
      <rect x="20" y="0" width="2" height="6" rx="1" fill={INK} />
      <circle cx="21" cy="0.8" r="1" fill="#FFD93D" />
      <rect x="7" y="6" width="4" height="1.6" rx="0.8" fill="#fff" opacity=".8" />
    </g>
  )},
  heart: { w: 56, vb: '0 0 28 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M14 24 C2 15 1 6 7 3.5 C11 2 14 5 14 7 C14 5 17 2 21 3.5 C27 6 26 15 14 24 Z" fill="#FF4FA0" {...cut} />
      <path d="M14 21.5 C6 15 4.5 9 7.5 6.5" fill="none" stroke="#E0246F" strokeWidth="1.2" opacity=".5" strokeLinecap="round" />
      <ellipse cx="9" cy="8" rx="3" ry="2" fill="#fff" opacity=".75" transform="rotate(-22 9 8)" />
      <circle cx="19" cy="7" r="1.1" fill="#fff" opacity=".6" />
    </g>
  )},
  star: { w: 56, vb: '0 0 30 29', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M15 1 L19 10.5 L29 11.3 L21.5 18 L23.8 28 L15 22.7 L6.2 28 L8.5 18 L1 11.3 L11 10.5 Z" fill="#FFD93D" {...cut} />
      <path d="M15 5 L17.4 11.2 L23.8 11.7 L19 16 L20.4 22.4 L15 19 L9.6 22.4 L11 16 L6.2 11.7 L12.6 11.2 Z" fill="#FFE678" />
      <ellipse cx="11" cy="10" rx="3" ry="2" fill="#fff" opacity=".75" transform="rotate(-20 11 10)" />
      <circle cx="20" cy="9" r="1" fill="#fff" opacity=".6" />
    </g>
  )},
  sparkle: { w: 48, vb: '0 0 24 24', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M11 1 C12 7 14 9 21 11.5 C14 14 12 16 11 22 C10 16 8 14 1 11.5 C8 9 10 7 11 1 Z" fill="#C79BFF" {...cut} />
      <path d="M19 14 C19.5 16.5 20.5 17.5 23 18.2 C20.5 19 19.5 20 19 22.5 C18.5 20 17.5 19 15 18.2 C17.5 17.5 18.5 16.5 19 14 Z" fill="#FFD93D" {...cutThin} />
      <circle cx="11" cy="11.5" r="2" fill="#fff" opacity=".85" />
    </g>
  )},
  lips: { w: 60, vb: '0 0 32 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M3 8 C7 1 13 3 16 6 C19 3 25 1 29 8 C24 16 8 16 3 8 Z" fill="#FF3D8F" {...cut} />
      <path d="M3 8 C12 10 20 10 29 8 C24 16 8 16 3 8 Z" fill="#E0246F" />
      <ellipse cx="10" cy="6" rx="3" ry="1.4" fill="#fff" opacity=".7" transform="rotate(-10 10 6)" />
      <circle cx="22" cy="5.5" r="1" fill="#fff" opacity=".65" />
      <circle cx="14" cy="11.5" r="0.9" fill="#FF8AD0" opacity=".8" />
    </g>
  )},
  cherry: { w: 52, vb: '0 0 26 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M8 19 C13 9 16 5 22 2" fill="none" stroke="#5BAF4E" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18 18 C19 10 20 6 22 2" fill="none" stroke="#4E9A42" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 2.5 C19 0.5 15 1.5 14 4.5 C18.5 5 21 4 22 2.5 Z" fill="#7CCB6B" {...cutThin} />
      <path d="M15.5 3.6 C17.8 3.6 20 3 21.4 2.4" fill="none" stroke="#4E9A42" strokeWidth="0.8" />
      <circle cx="8" cy="23" r="6" fill="#FF3D6E" {...cut} />
      <circle cx="19" cy="22" r="6" fill="#FF5FB0" {...cut} />
      <ellipse cx="6" cy="21" rx="2" ry="1.4" fill="#fff" opacity=".75" transform="rotate(-25 6 21)" />
      <ellipse cx="17" cy="20" rx="2" ry="1.4" fill="#fff" opacity=".75" transform="rotate(-25 17 20)" />
    </g>
  )},
  smiley: { w: 52, vb: '0 0 26 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <circle cx="13" cy="13" r="11.5" fill="#FFD93D" {...cut} />
      <circle cx="9" cy="10.5" r="1.7" fill={INK} />
      <circle cx="17" cy="10.5" r="1.7" fill={INK} />
      <ellipse cx="6.5" cy="14" rx="2" ry="1.2" fill="#FF8AD0" opacity=".85" />
      <ellipse cx="19.5" cy="14" rx="2" ry="1.2" fill="#FF8AD0" opacity=".85" />
      <path d="M8 15.5 C10.5 19 15.5 19 18 15.5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="9" cy="7" rx="3" ry="1.6" fill="#fff" opacity=".7" transform="rotate(-18 9 7)" />
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
      <path d="M21 5.5 C21.3 7 21.9 7.6 23.4 8 C21.9 8.4 21.3 9 21 10.5 C20.7 9 20.1 8.4 18.6 8 C20.1 7.6 20.7 7 21 5.5 Z" fill="#fff" opacity=".9" />
    </g>
  )},
  crown: { w: 60, vb: '0 0 32 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M9 3 C9.2 4.2 9.7 4.7 10.9 5 C9.7 5.3 9.2 5.8 9 7 C8.8 5.8 8.3 5.3 7.1 5 C8.3 4.7 8.8 4.2 9 3 Z" fill="#FFD93D" opacity=".9" />
      <path d="M25 2 C25.2 3.2 25.7 3.7 26.9 4 C25.7 4.3 25.2 4.8 25 6 C24.8 4.8 24.3 4.3 23.1 4 C24.3 3.7 24.8 3.2 25 2 Z" fill="#FF8AD0" opacity=".9" />
      <path d="M3 21 L4.5 9 L11 14 L16 5 L21 14 L27.5 9 L29 21 Z" fill="#FFD93D" {...cut} />
      <rect x="3" y="21" width="26" height="3.5" rx="1.5" fill="#FFC53D" {...cutThin} />
      <circle cx="9.5" cy="17.5" r="1.7" fill="#FF5FB0" />
      <circle cx="16" cy="16.5" r="1.9" fill="#9B5CFF" />
      <circle cx="22.5" cy="17.5" r="1.7" fill="#3FB8DE" />
      <circle cx="16" cy="5" r="1.6" fill="#FF5FB0" {...cutThin} />
      <ellipse cx="9" cy="12.5" rx="2" ry="1" fill="#fff" opacity=".6" transform="rotate(-18 9 12.5)" />
    </g>
  )},
  flame: { w: 50, vb: '0 0 22 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M11 1 C15 7 20 10 20 18 A9 9 0 0 1 2 18 C2 13 5 11 6 7 C8 10 10 10 11 1 Z" fill="#FF7A3D" {...cut} />
      <path d="M11 12 C13 15 15 16 15 20 A4.5 4.5 0 0 1 6.5 20 C6.5 17 9 16 11 12 Z" fill="#FFD93D" />
      <circle cx="11" cy="20.5" r="1.8" fill="#FFF5D6" />
      <circle cx="16" cy="9" r="1" fill="#FFD93D" opacity=".8" />
    </g>
  )},
  bow: { w: 58, vb: '0 0 32 20', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M14 10 C8 3 2 3 2 9 C2 15 8 16 14 11 Z" fill="#FF8AD0" {...cut} />
      <path d="M18 10 C24 3 30 3 30 9 C30 15 24 16 18 11 Z" fill="#FF8AD0" {...cut} />
      <circle cx="7" cy="9" r="1" fill="#fff" opacity=".85" />
      <circle cx="10" cy="12" r="0.8" fill="#fff" opacity=".85" />
      <circle cx="25" cy="9" r="1" fill="#fff" opacity=".85" />
      <circle cx="22" cy="12" r="0.8" fill="#fff" opacity=".85" />
      <path d="M12 11 L9 19 L13 18 Z" fill="#FF5FB0" {...cutThin} />
      <path d="M20 11 L23 19 L19 18 Z" fill="#FF5FB0" {...cutThin} />
      <circle cx="16" cy="10" r="3.4" fill="#FF5FB0" {...cut} />
      <circle cx="15" cy="9" r="1" fill="#fff" opacity=".75" />
    </g>
  )},
  gem: { w: 52, vb: '0 0 28 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M7 2 L21 2 L26 9 L14 24 L2 9 Z" fill="#FF8AD0" {...cut} />
      <path d="M7 2 L10.5 9 L2 9 Z" fill="#FFB6E1" />
      <path d="M21 2 L26 9 L17.5 9 Z" fill="#FF6FBC" />
      <path d="M10.5 9 L14 24 L2 9 Z" fill="#FF5FB0" />
      <path d="M17.5 9 L26 9 L14 24 Z" fill="#E0469B" />
      <path d="M10.5 9 L17.5 9 L14 24 Z" fill="#FF8AD0" />
      <path d="M7 2 L21 2 L17.5 9 L10.5 9 Z" fill="#FFD0EC" />
      <circle cx="11" cy="5" r="1.1" fill="#fff" opacity=".9" />
    </g>
  )},
  sunglasses: { w: 64, vb: '0 0 34 16', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M1 4 L5 2 M33 4 L29 2" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="9.5" cy="8" rx="7" ry="6" fill="#9B5CFF" {...cut} />
      <ellipse cx="24.5" cy="8" rx="7" ry="6" fill="#9B5CFF" {...cut} />
      <ellipse cx="9.5" cy="8" rx="5.4" ry="4.5" fill="#C79BFF" opacity=".75" />
      <ellipse cx="24.5" cy="8" rx="5.4" ry="4.5" fill="#C79BFF" opacity=".75" />
      <path d="M16.5 7 C17 6 17.5 6 18 7" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="7" cy="6" rx="2.2" ry="1.2" fill="#fff" opacity=".75" transform="rotate(-18 7 6)" />
      <ellipse cx="22" cy="6" rx="2.2" ry="1.2" fill="#fff" opacity=".75" transform="rotate(-18 22 6)" />
    </g>
  )},
  cassette: { w: 64, vb: '0 0 34 22', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="31" height="19" rx="2.5" fill="#9B5CFF" {...cut} />
      <rect x="4" y="4" width="26" height="8" rx="1.5" fill="#FFD6EE" />
      <circle cx="11" cy="8" r="2.6" fill="#fff" stroke={INK} strokeWidth="1" />
      <circle cx="23" cy="8" r="2.6" fill="#fff" stroke={INK} strokeWidth="1" />
      <rect x="13.6" y="7" width="6.8" height="2" fill="#C79BFF" />
      <path d="M9 17 L12 14 L22 14 L25 17 Z" fill="#7B3FE4" />
      <rect x="5" y="4.6" width="9" height="1.4" rx="0.7" fill="#FF5FB0" opacity=".7" />
    </g>
  )},
  lipgloss: { w: 40, vb: '0 0 16 32', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="4" y="1.5" width="8" height="8" rx="1.5" fill="#FFB6E1" {...cut} />
      <rect x="6.6" y="9.5" width="2.8" height="3" fill="#E0469B" />
      <rect x="3" y="12" width="10" height="18" rx="3" fill="#FF8AD0" opacity=".92" {...cut} />
      <rect x="5" y="14" width="6" height="14" rx="2.4" fill="#FF5FB0" opacity=".8" />
      <rect x="4.8" y="13.5" width="2" height="15" rx="1" fill="#fff" opacity=".55" />
      <path d="M5.5 17 C7.5 16.4 9.5 16.4 11 17" stroke="#fff" strokeWidth="0.8" opacity=".6" fill="none" />
    </g>
  )},
  rainbow: { w: 62, vb: '0 0 34 20', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M4 16 A13 13 0 0 1 30 16" fill="none" stroke="#FF5FB0" strokeWidth="3.4" {...{ paintOrder: 'stroke' }} style={{ stroke: '#FF5FB0' }} strokeLinecap="round" />
      <path d="M7.5 16 A9.5 9.5 0 0 1 26.5 16" fill="none" stroke="#FFD93D" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M11 16 A6 6 0 0 1 23 16" fill="none" stroke="#9B5CFF" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="4.5" cy="16" r="3.4" fill="#fff" stroke="#E6DAF5" strokeWidth="1" />
      <circle cx="7.8" cy="17" r="2.6" fill="#fff" stroke="#E6DAF5" strokeWidth="1" />
      <circle cx="29.5" cy="16" r="3.4" fill="#fff" stroke="#E6DAF5" strokeWidth="1" />
      <circle cx="26.2" cy="17" r="2.6" fill="#fff" stroke="#E6DAF5" strokeWidth="1" />
    </g>
  )},
  peace: { w: 50, vb: '0 0 26 26', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <circle cx="13" cy="13" r="11.5" fill="#3FB8DE" {...cut} />
      <circle cx="13" cy="13" r="8.6" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M13 4.4 L13 21.6 M13 13 L7 19 M13 13 L19 19" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="8.5" cy="7" rx="2.4" ry="1.3" fill="#fff" opacity=".55" transform="rotate(-20 8.5 7)" />
    </g>
  )},
  xoxo: { w: 78, vb: '0 0 44 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="41" height="15" rx="7.5" fill="#FF5FB0" {...cut} />
      <rect x="4" y="3.5" width="35" height="4" rx="2" fill="#fff" opacity=".22" />
      <text x="22" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="12" fill="#fff" letterSpacing="1.5">XOXO</text>
    </g>
  )},
  omg: { w: 66, vb: '0 0 36 30', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <path d="M18 1 L21.5 7 L28 4.5 L27 11 L34 12.5 L28.5 17 L33 22.5 L26 22.5 L26.5 29 L18 25 L9.5 29 L10 22.5 L3 22.5 L7.5 17 L2 12.5 L9 11 L8 4.5 L14.5 7 Z" fill="#FFD93D" {...cut} />
      <path d="M18 5.5 L20.5 10 L25.5 8.2 L24.8 13 L30 14.2 L25.8 17.5" fill="none" stroke="#FFC53D" strokeWidth="1" opacity=".8" />
      <text x="18" y="19.5" textAnchor="middle" fontFamily="VT323, monospace" fontSize="10.5" fill={INK} fontWeight="bold">OMG!</text>
    </g>
  )},
  drama: { w: 86, vb: '0 0 50 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="47" height="15" rx="4" fill="#9B5CFF" {...cut} />
      <rect x="4" y="3.5" width="41" height="4" rx="2" fill="#fff" opacity=".2" />
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
      <rect x="4" y="3.5" width="31" height="3.5" rx="1.75" fill="#fff" opacity=".5" />
      <text x="20" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="11" fill="#E0246F" letterSpacing="1.2">IT GIRL ✦</text>
    </g>
  )},
  whatever: { w: 82, vb: '0 0 48 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="45" height="15" rx="4" fill="#E6DAF5" {...cut} />
      <text x="24" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="11.5" fill="#6E5499" letterSpacing="1">WHATEVER.</text>
    </g>
  )},
  brb: { w: 56, vb: '0 0 30 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="27" height="15" rx="7.5" fill="#3FB8DE" {...cut} />
      <rect x="4" y="3.5" width="22" height="4" rx="2" fill="#fff" opacity=".25" />
      <text x="15" y="13" textAnchor="middle" fontFamily="VT323, monospace" fontSize="11.5" fill="#fff" letterSpacing="1.5">BRB ☆</text>
    </g>
  )},
  mainchar: { w: 100, vb: '0 0 60 18', el: (
    <g style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
      <rect x="1.5" y="1.5" width="57" height="15" rx="7.5" fill="#FF5FB0" {...cut} />
      <rect x="4" y="3.5" width="51" height="4" rx="2" fill="#fff" opacity=".22" />
      <text x="30" y="12.6" textAnchor="middle" fontFamily="VT323, monospace" fontSize="10" fill="#fff" letterSpacing="0.8">MAIN CHARACTER</text>
    </g>
  )},
};

const STICKER_KEYS = Object.keys(STICKERS);

// ---------- cut-out alphabet (original ransom-note / scrapbook style) ----------
// Each letter looks like it was scissored from a different magazine page:
// its paper color, ink, font, and tilt are derived from the letter itself,
// so an "A" always looks like the same "A" — spell anything across the page.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PAPERS = [
  { bg: '#FF5FB0', fg: '#FFFFFF' },
  { bg: '#FFD93D', fg: INK },
  { bg: '#9B5CFF', fg: '#FFFFFF' },
  { bg: '#FFFDF9', fg: '#E0246F' },
  { bg: '#3FB8DE', fg: '#FFFFFF' },
  { bg: '#FFD6EE', fg: INK },
  { bg: INK, fg: '#FFD93D' },
];
const CUT_FONTS = [
  "Georgia, 'Times New Roman', serif",
  "'Arial Black', 'Helvetica Neue', sans-serif",
  "VT323, monospace",
  "'Courier New', Courier, monospace",
  "'Comic Sans MS', 'Marker Felt', cursive",
];

function LetterArt({ ch, scale = 1 }) {
  const c = ch.charCodeAt(0);
  const paper = PAPERS[c % PAPERS.length];
  const font = CUT_FONTS[(c * 3) % CUT_FONTS.length];
  const tilt = ((c * 7) % 13) - 6;          // -6 … +6 deg
  const skewW = 20 + ((c * 5) % 4);          // slightly irregular scrap widths
  const w = 34 * scale;
  return (
    <svg width={w} height={(w * 26) / 24} viewBox="0 0 24 26" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={`rotate(${tilt} 12 13)`} style={{ filter: 'drop-shadow(1px 2px 1.5px rgba(54,33,92,.35))' }}>
        <rect x={(24 - skewW) / 2} y="2.5" width={skewW} height="21" rx="1.5" fill={paper.bg} {...cut} />
        {/* a strip of "tape" over the top edge */}
        <rect x="6" y="0.5" width="12" height="4.5" rx="1" fill="#FFFFFF" opacity=".45" transform={`rotate(${-tilt * 0.6} 12 2.5)`} />
        <text x="12" y="19.5" textAnchor="middle" fontFamily={font} fontSize="15" fontWeight="bold" fill={paper.fg}>{ch}</text>
      </g>
    </svg>
  );
}

function StickerArt({ kind, scale = 1 }) {
  if (kind?.startsWith('letter:')) {
    return <LetterArt ch={kind.slice(7, 8).toUpperCase()} scale={scale} />;
  }
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
export default function StickerLayer({ dock = null }) {
  const [userId, setUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mounted, setMounted] = useState(false);
  const dragRef = useRef(null); // {id, startX, startY, origXPct, origYPct, moved}
  useEffect(() => { setMounted(true); }, []);

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
      // y is page pixels: drop it in the middle of whatever's on screen now
      y_pct: Math.round(window.scrollY + window.innerHeight * 0.38 + Math.random() * 60),
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
    const maxY = Math.max(200, document.documentElement.scrollHeight - 30);
    const x = Math.min(98, Math.max(1, d.origXPct + (dx / window.innerWidth) * 100));
    const y = Math.min(maxY, Math.max(12, d.origYPct + dy)); // page pixels
    setItems(prev => prev.map(s => (s.id === d.id ? { ...s, x_pct: x, y_pct: y } : s)));
  };
  const onPointerUp = (e, st) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== st.id) return;
    if (d.moved) {
      const cur = items.find(s => s.id === st.id);
      if (cur) persist(st.id, { x_pct: cur.x_pct, y_pct: cur.y_pct });
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
      {/* placed stickers — anchored to the page itself, scroll with content */}
      {mounted && createPortal(
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 35 }}>
        {items.map(st => (
          <div key={st.id} data-sticker
            onPointerDown={(e) => onPointerDown(e, st)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e, st)}
            style={{
              position: 'absolute', left: `${st.x_pct}%`, top: `${st.y_pct}px`,
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
      </div>,
      document.body)}

      {/* dock button — bottom left */}
      <button onClick={() => { if (dock) { setDockOpen(o => !o); setTrayOpen(false); } else { setTrayOpen(o => !o); } }} title="Dock"
        style={{
          position: 'fixed', left: 14, bottom: 'calc(14px + env(safe-area-inset-bottom))', zIndex: 36,
          width: 46, height: 46, borderRadius: 999, background: C.sun, color: C.ink,
          border: `2px solid ${C.ink}`, boxShadow: C.shadowStrong, cursor: 'pointer',
          fontFamily: 'VT323, monospace', fontSize: 22, lineHeight: '40px',
        }}>✦</button>

      {/* DOCK.EXE — choose your floating toys */}
      {dockOpen && dock && (
        <div style={{
          position: 'fixed', left: 12, bottom: 'calc(68px + env(safe-area-inset-bottom))', zIndex: 60,
          width: 'min(250px, 92vw)', background: C.card, border: `2px solid ${C.ink}`,
          borderRadius: 12, boxShadow: C.shadowStrong, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', background: C.sun, borderBottom: `2px solid ${C.ink}` }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FF6FB5', border: `1.5px solid ${C.ink}` }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#9B5CFF', border: `1.5px solid ${C.ink}` }} />
            </span>
            <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.ink }}>Dock.exe</span>
            <button onClick={() => setDockOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: C.ink2 }}>✕</button>
          </div>
          <div style={{ padding: 8 }}>
            {[
              { icon: '✂', label: 'stickers', action: () => { setDockOpen(false); setTrayOpen(true); }, state: null },
              { icon: '♪', label: 'tape.exe', action: () => dock.onToggle('ipod'), state: dock.ipod },
              { icon: '★', label: 'photobooth.exe', action: () => dock.onToggle('booth'), state: dock.booth },
            ].map(row => (
              <button key={row.label} onClick={row.action}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', borderRadius: 8, padding: '10px 8px', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: 'VT323, monospace', fontSize: 18, color: C.ink, width: 20, textAlign: 'center' }}>{row.icon}</span>
                <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: C.ink }}>{row.label}</span>
                {row.state === null ? (
                  <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, fontWeight: 600, color: C.ink3 }}>open ▸</span>
                ) : (
                  <span style={{
                    fontFamily: 'Inter Tight, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    padding: '3px 9px', borderRadius: 999, border: `1.5px solid ${C.ink}`,
                    background: row.state ? '#7DD87F' : '#fff', color: C.ink,
                  }}>{row.state ? 'ON' : 'OFF'}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
            <div style={{ fontFamily: 'VT323, monospace', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: C.ink2, margin: '14px 0 8px' }}>
              cut-out letters ✂ spell anything
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {ALPHABET.map(L => (
                <button key={L} onClick={() => addSticker(`letter:${L}`)} title={`Letter ${L}`}
                  style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '5px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StickerArt kind={`letter:${L}`} scale={0.62} />
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
