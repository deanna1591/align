'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';

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
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) setError(signInError.message);
    else window.location.href = '/';
  };

  const submitMagic = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
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
    width: '100%',
    padding: '0.7rem 0.85rem',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '1rem',
    color: '#4A2E7A',
    background: '#FFFFFF',
    border: '2px solid #4A2E7A',
    borderRadius: '8px',
    outline: 'none',
    marginBottom: '0.7rem',
  };

  const btnStyle = {
    width: '100%',
    padding: '0.72rem 1rem',
    background: '#FF5FB0',
    color: 'white',
    border: '2px solid #4A2E7A',
    borderRadius: '9px',
    boxShadow: '2px 2px 0 rgba(91,62,142,0.28)',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: loading ? 0.6 : 1,
  };

  const toggleStyle = {
    display: 'block',
    margin: '1rem auto 0',
    background: 'none',
    border: 'none',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.82rem',
    color: '#8B6FB8',
    cursor: 'pointer',
    textDecoration: 'underline',
  };

  const errorStyle = {
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.8rem',
    color: '#C0392B',
    marginTop: '0.75rem',
    textAlign: 'center',
  };

  const dot = (bg) => ({ width: 10, height: 10, borderRadius: 999, background: bg, border: '1.5px solid #4A2E7A' });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FEF7FC',
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Inter+Tight:wght@400;500;600;700&display=swap');
      `}</style>

      <div style={{
        maxWidth: 360,
        width: '100%',
        background: '#FFFDF9',
        border: '2px solid #4A2E7A',
        borderRadius: 12,
        boxShadow: '4px 4px 0 rgba(91,62,142,0.20)',
        overflow: 'hidden',
      }}>
        {/* title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FFB3DE', borderBottom: '2px solid #4A2E7A' }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            <span style={dot('#FF6FB5')} /><span style={dot('#FCD93D')} /><span style={dot('#9B5CFF')} />
          </span>
          <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '1.15rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4A2E7A' }}>WELCOME.EXE</span>
        </div>

        <div style={{ padding: '30px 26px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '1.25rem', color: '#4A2E7A', lineHeight: 1 }}>align</span>
            <span style={{ color: '#FF5FB0', fontSize: '1.1rem' }}>✦</span>
          </div>
          <p style={{
            fontFamily: 'VT323, monospace',
            fontSize: '1.2rem',
            color: '#8B6FB8',
            textAlign: 'center',
            letterSpacing: '0.03em',
            marginBottom: '1.9rem',
          }}>Sign in to sync across your devices.</p>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.6rem', color: '#4A2E7A', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.4rem' }}>
                Check your email
              </p>
              <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: '#8B6FB8' }}>
                We sent a sign-in link to <strong style={{ color: '#4A2E7A' }}>{email}</strong>.
              </p>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={submitPassword}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
                style={inputStyle}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                required
                style={inputStyle}
              />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              {error && <p style={errorStyle}>{error}</p>}
              <button
                type="button"
                onClick={() => { setMode('magic'); setError(''); }}
                style={toggleStyle}
              >
                Send a magic link instead
              </button>
            </form>
          ) : (
            <form onSubmit={submitMagic}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
                style={inputStyle}
              />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
              {error && <p style={errorStyle}>{error}</p>}
              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); }}
                style={toggleStyle}
              >
                Use password instead
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
