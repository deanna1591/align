'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';

const INK = '#36215C';
const C = {
  ink: INK, ink2: '#6E5499', ink3: '#9F88C9',
  accent: '#FF5FB0', warm: '#9B5CFF', sun: '#FCD93D', sky: '#3FB8DE',
  card: '#FFFDF9', bg: '#FEFBFD',
};

const MARQUEE = '\u2605 momentum, not pressure \u2605 pick three things \u2605 close the day \u2605 plan like it\u2019s 2003 \u2605 so cute \u2605 drama-free \u2605 ';

export default function LoginPage() {
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) setError(signInError.message);
    else window.location.href = '/';
  };

  const submitMagic = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (otpError) setError(otpError.message);
    else setSent(true);
  };

  const inputStyle = {
    width: '100%', padding: '0.72rem 0.9rem', fontFamily: 'Inter Tight, sans-serif',
    fontSize: '16px', color: INK, background: '#FFFFFF', border: `2px solid ${INK}`,
    borderRadius: 8, outline: 'none', marginBottom: '0.7rem', boxSizing: 'border-box',
    boxShadow: 'inset 2px 2px 0 rgba(54,33,92,0.08)',
  };
  const errorStyle = { fontFamily: 'Inter Tight, sans-serif', fontSize: '0.82rem', color: '#C0392B', marginTop: '0.75rem', textAlign: 'center' };
  const dot = (bg) => ({ width: 11, height: 11, borderRadius: 999, background: bg, border: `1.5px solid ${INK}` });

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      backgroundColor: C.bg,
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 1rem 1rem',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Inter+Tight:wght@400;500;600;700&display=swap');
        @keyframes mq { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes bob { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-10px) rotate(var(--r,0deg)); } }
        @keyframes blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } }
        @keyframes pop { 0% { transform: scale(0.96); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .bob { animation: bob 4.2s ease-in-out infinite; }
        .lbtn { transition: transform .1s ease, box-shadow .1s ease; }
        .lbtn:hover { transform: translate(-1px,-1px); box-shadow: 4px 5px 0 rgba(54,33,92,0.3); }
        .lbtn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 rgba(54,33,92,0.25); }
        .ghost:hover { color: ${C.accent}; }
      `}</style>

      {/* top marquee ticker */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, overflow: 'hidden', background: INK, padding: '7px 0', zIndex: 5 }}>
        <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'mq 22s linear infinite', fontFamily: 'VT323, monospace', fontSize: 18, letterSpacing: '.14em', color: C.sun, textTransform: 'uppercase' }}>
          <span>{MARQUEE}{MARQUEE}</span>
        </div>
      </div>

      {/* floating stickers */}
      <div className="bob" style={{ position: 'absolute', left: '8%', top: '16%', fontSize: 54, ['--r']: '-12deg', filter: 'drop-shadow(3px 4px 4px rgba(54,33,92,.28))', pointerEvents: 'none' }}>🦋</div>
      <div className="bob" style={{ position: 'absolute', right: '9%', top: '20%', fontSize: 48, ['--r']: '10deg', animationDelay: '.6s', filter: 'drop-shadow(3px 4px 4px rgba(54,33,92,.28))', pointerEvents: 'none' }}>💖</div>
      <div className="bob" style={{ position: 'absolute', left: '11%', bottom: '15%', fontSize: 44, ['--r']: '8deg', animationDelay: '1.2s', filter: 'drop-shadow(3px 4px 4px rgba(54,33,92,.28))', pointerEvents: 'none' }}>📟</div>
      <div className="bob" style={{ position: 'absolute', right: '11%', bottom: '17%', ['--r']: '-6deg', animationDelay: '.3s', background: C.accent, color: '#fff', border: '3px solid #fff', borderRadius: 99, boxShadow: '3px 4px 6px rgba(54,33,92,.3)', fontFamily: 'VT323, monospace', fontSize: 20, letterSpacing: '.12em', padding: '5px 16px', pointerEvents: 'none' }}>XOXO</div>

      {/* login window */}
      <div style={{ maxWidth: 372, width: '100%', background: C.card, border: `2.5px solid ${INK}`, borderRadius: 14, boxShadow: '5px 5px 0 rgba(54,33,92,0.2)', overflow: 'hidden', position: 'relative', zIndex: 10, animation: 'pop .3s ease-out' }}>
        {/* title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FFB3DE', borderBottom: `2.5px solid ${INK}` }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            <span style={dot('#FF6FB5')} /><span style={dot(C.sun)} /><span style={dot(C.warm)} />
          </span>
          <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '1.18rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: INK }}>welcome.exe</span>
          <span style={{ fontFamily: 'VT323, monospace', fontSize: '1rem', color: C.ink2 }}>♥</span>
        </div>

        <div style={{ padding: '28px 26px 26px' }}>
          {/* pixel wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ color: C.sun, fontSize: '1rem' }}>✦</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '1.35rem', color: INK, lineHeight: 1, textShadow: `2px 2px 0 ${C.accent}` }}>align</span>
            <span style={{ color: C.accent, fontSize: '1.1rem' }}>✦</span>
          </div>
          <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.25rem', color: C.ink2, textAlign: 'center', letterSpacing: '0.03em', marginBottom: '1.7rem' }}>
            {mode === 'password' ? 'welcome back, bestie ✦' : 'we\u2019ll email you a magic link ✦'}
          </p>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>💌</div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.7rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.4rem' }}>
                check your email
              </p>
              <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.88rem', color: C.ink2, lineHeight: 1.5 }}>
                We sent a sign-in link to <strong style={{ color: INK }}>{email}</strong>.
              </p>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={submitPassword}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus required style={inputStyle} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" required style={inputStyle} />
              <button type="submit" disabled={loading} className="lbtn" style={{ width: '100%', padding: '0.8rem 1rem', background: C.accent, color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 11, boxShadow: '4px 4px 0 rgba(54,33,92,0.24)', fontFamily: 'Inter Tight, sans-serif', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.01em' }}>
                {loading ? 'signing in…' : 'sign in ✦'}
              </button>
              {error && <p style={errorStyle}>{error}</p>}
              <button type="button" onClick={() => { setMode('magic'); setError(''); }} className="ghost" style={{ display: 'block', margin: '1.1rem auto 0', background: 'none', border: 'none', fontFamily: 'VT323, monospace', fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.ink2, cursor: 'pointer' }}>
                ✉ send a magic link instead
              </button>
            </form>
          ) : (
            <form onSubmit={submitMagic}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus required style={inputStyle} />
              <button type="submit" disabled={loading} className="lbtn" style={{ width: '100%', padding: '0.8rem 1rem', background: C.warm, color: '#fff', border: `2.5px solid ${INK}`, borderRadius: 11, boxShadow: '4px 4px 0 rgba(54,33,92,0.24)', fontFamily: 'Inter Tight, sans-serif', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.01em' }}>
                {loading ? 'sending…' : 'send sign-in link ✦'}
              </button>
              {error && <p style={errorStyle}>{error}</p>}
              <button type="button" onClick={() => { setMode('password'); setError(''); }} className="ghost" style={{ display: 'block', margin: '1.1rem auto 0', background: 'none', border: 'none', fontFamily: 'VT323, monospace', fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.ink2, cursor: 'pointer' }}>
                🔑 use password instead
              </button>
            </form>
          )}
        </div>

        {/* footer strip */}
        <div style={{ borderTop: `2px dashed #E3D6F4`, padding: '10px 12px', textAlign: 'center', fontFamily: 'VT323, monospace', fontSize: '0.95rem', letterSpacing: '0.06em', color: C.ink3, textTransform: 'uppercase' }}>
          ★ momentum, not pressure ★
        </div>
      </div>

      <p style={{ position: 'relative', zIndex: 10, marginTop: 18, fontFamily: 'VT323, monospace', fontSize: '1.05rem', color: C.ink3, letterSpacing: '0.05em' }}>
        new here? signing in makes your account <span style={{ animation: 'blink 1.1s step-end infinite' }}>▌</span>
      </p>
    </div>
  );
}
