'use client';

// lib/sfx.js
// Tiny synthesized sound effects for Align — no audio files, all Web Audio.
// Respects a global mute saved in localStorage ('align_sfx_muted').
// Usage: import { sfx } from '@/lib/sfx'; sfx.play('check');

let ctx = null;
function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // browsers suspend audio until a user gesture; resume on demand
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function isMuted() {
  try { return localStorage.getItem('align_sfx_muted') === '1'; } catch { return false; }
}
export function setMuted(v) {
  try { localStorage.setItem('align_sfx_muted', v ? '1' : '0'); } catch {}
}

// a single oscillator blip
function blip(c, { freq = 440, type = 'sine', dur = 0.12, gain = 0.18, slideTo = null, delay = 0 }) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// short filtered-noise burst (for the camera shutter / cassette mechanism)
function noise(c, { dur = 0.08, gain = 0.25, delay = 0, hp = 800 }) {
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource(); src.buffer = buf;
  const filter = c.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + dur);
}

const SOUNDS = {
  // soft pop when a task is checked off
  check: (c) => { blip(c, { freq: 660, type: 'triangle', dur: 0.1, gain: 0.16, slideTo: 990 }); },
  // gentle two-note chime when closing the day
  chime: (c) => {
    blip(c, { freq: 784, type: 'sine', dur: 0.32, gain: 0.14 });
    blip(c, { freq: 1175, type: 'sine', dur: 0.5, gain: 0.12, delay: 0.12 });
  },
  // mechanical "ka-chunk" for the cassette play button
  cassette: (c) => {
    noise(c, { dur: 0.05, gain: 0.22, hp: 1200 });
    blip(c, { freq: 150, type: 'square', dur: 0.08, gain: 0.12, delay: 0.03 });
  },
  // camera shutter for the photobooth
  shutter: (c) => {
    noise(c, { dur: 0.04, gain: 0.3, hp: 2000 });
    noise(c, { dur: 0.05, gain: 0.22, hp: 2000, delay: 0.07 });
  },
  // celebratory rising sparkle for milestones / sticker unlocks
  sparkle: (c) => {
    blip(c, { freq: 880, type: 'triangle', dur: 0.1, gain: 0.12 });
    blip(c, { freq: 1320, type: 'triangle', dur: 0.1, gain: 0.12, delay: 0.08 });
    blip(c, { freq: 1760, type: 'triangle', dur: 0.18, gain: 0.1, delay: 0.16 });
  },
  // retro startup tone for the boot screen
  boot: (c) => {
    blip(c, { freq: 392, type: 'square', dur: 0.12, gain: 0.1 });
    blip(c, { freq: 523, type: 'square', dur: 0.12, gain: 0.1, delay: 0.1 });
    blip(c, { freq: 784, type: 'square', dur: 0.22, gain: 0.1, delay: 0.2 });
  },
};

export const sfx = {
  play(name) {
    if (isMuted()) return;
    const c = ac();
    if (!c) return;
    const fn = SOUNDS[name];
    if (fn) { try { fn(c); } catch {} }
  },
};
