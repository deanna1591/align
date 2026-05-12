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
    padding: '0.75rem 1rem',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.95rem',
    color: '#1B1813',
    background: '#FAFAFA',
    border: '1px solid #EAEAEA',
    borderRadius: '8px',
    outline: 'none',
    marginBottom: '0.75rem',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..600,30..100&family=Inter+Tight:wght@400;500;600;700&display=swap');
      `}</style>
      <div style={{ maxWidth: 360, width: '100%' }}>
        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: '2.75rem',
          fontWeight: 400,
          letterSpacing: '-0.035em',
          color: '#1B1813',
          textAlign: 'center',
          fontVariationSettings: "'SOFT' 100, 'opsz' 144",
          marginBottom: '0.5rem',
        }}>align</h1>
        <p style={{
          fontFamily: 'Fraunces, serif',
          fontStyle: 'italic',
          fontSize: '0.95rem',
          color: '#9A917F',
          textAlign: 'center',
          marginBottom: '2.5rem',
        }}>Sign in to sync across your devices.</p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem', color: '#1B1813', marginBottom: '0.5rem' }}>
              Check your email.
            </p>
            <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: '#5C5448' }}>
              We sent a sign-in link to <strong>{email}</strong>.
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
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: '#7CA481',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {error && (
              <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.8rem', color: '#a8493a', marginTop: '0.75rem', textAlign: 'center' }}>
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setMode('magic'); setError(''); }}
              style={{
                display: 'block',
                margin: '1rem auto 0',
                background: 'none',
                border: 'none',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.8rem',
                color: '#9A917F',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
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
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: '#7CA481',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
            {error && (
              <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.8rem', color: '#a8493a', marginTop: '0.75rem', textAlign: 'center' }}>
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); }}
              style={{
                display: 'block',
                margin: '1rem auto 0',
                background: 'none',
                border: 'none',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.8rem',
                color: '#9A917F',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Use password instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
