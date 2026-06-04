'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Brain, Calendar, ExternalLink, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

const palette = {
  bg: '#FFFFFF',
  bgRaised: '#FAFAFA',
  ink: '#1A1A1A',
  ink2: '#5C5448',
  ink3: '#9A917F',
  border: '#EAEAEA',
  borderSoft: '#F2F2F2',
  accent: '#7CA481',
  accentSoft: 'rgba(124,164,129,0.10)',
  warn: '#C9824A',
  errInk: '#8C3A2A',
  errBg: '#FBE9E5',
};

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function friendlyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const newId = (prefix = 'b') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function CapturePage({ userId }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const speechSupported = useRef(false);
  const supabase = useRef(null);

  useEffect(() => {
    speechSupported.current = !!getSpeechRecognition();
    supabase.current = createClient();
    // Auto-focus the input on open. Slight delay so iOS Safari respects it.
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
    setInterimText('');
  };

  const startListening = () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError('Voice input not supported in this browser.');
      return;
    }
    try {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
          else interimChunk += event.results[i][0].transcript;
        }
        if (finalChunk) {
          setText(prev => (prev + ' ' + finalChunk).trim());
          setInterimText('');
        } else {
          setInterimText(interimChunk);
        }
      };
      recognition.onerror = (e) => {
        if (e.error === 'not-allowed') setError('Microphone permission denied.');
        else if (e.error !== 'no-speech') setError(`Mic error: ${e.error}`);
        stopListening();
      };
      recognition.onend = () => { setListening(false); setInterimText(''); };
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      setError(null);
    } catch (e) {
      setError(`Could not start mic: ${e.message}`);
    }
  };

  // Submit flow:
  //   1. Send text to /api/parse-task.
  //   2. If parsed as event → POST /api/google/create-event.
  //      Else → direct supabase insert into brain_dump (same as main app's addBrain).
  //   3. Show status, then reset the input so user can capture again right away.
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    if (status?.kind === 'processing') return;
    stopListening();
    setError(null);
    setStatus({ kind: 'processing', message: 'Reading your note…' });

    let parsed = null;
    try {
      const tz = (typeof Intl !== 'undefined')
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC';
      const res = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, user_timezone: tz, current_date: localToday() }),
      });
      if (res.ok) {
        const data = await res.json();
        parsed = data.parsed;
      }
    } catch (err) {
      console.error('[Capture] parse error:', err);
    }

    if (parsed?.is_event && parsed.date) {
      try {
        setStatus({ kind: 'processing', message: 'Adding to your calendar…' });
        const tz = (typeof Intl !== 'undefined')
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'UTC';
        const res = await fetch('/api/google/create-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: parsed.title,
            date: parsed.date,
            time: parsed.time,
            duration_minutes: parsed.duration_minutes || 60,
            all_day: !!parsed.all_day,
            user_timezone: tz,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setStatus({
          kind: 'success-event',
          message: `Added to ${data.label || 'Google'} calendar · ${friendlyDate(parsed.date)}`,
          link: data.html_link,
        });
        setText('');
        setInterimText('');
        // Status stays visible until next keystroke or 4s timeout.
        setTimeout(() => setStatus(s => (s?.kind === 'success-event' ? null : s)), 4000);
        return;
      } catch (err) {
        console.error('[Capture] event create error:', err);
        // Fall through to brain dump so the text isn't lost.
        setStatus({ kind: 'processing', message: 'Saving to brain dump instead…' });
      }
    }

    // Brain dump fallback — direct Supabase insert.
    try {
      const id = newId('b');
      const { error: insertErr } = await supabase.current
        .from('brain_dump')
        .insert({ id, user_id: userId, text: value });
      if (insertErr) throw insertErr;
      setStatus({ kind: 'success-brain', message: 'Captured to brain dump' });
      setText('');
      setInterimText('');
      setTimeout(() => setStatus(s => (s?.kind === 'success-brain' ? null : s)), 2500);
    } catch (err) {
      console.error('[Capture] brain dump error:', err);
      setStatus({ kind: 'error', message: `Couldn't save: ${err.message || 'unknown'}` });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const isBusy = status?.kind === 'processing';

  return (
    <div style={{
      minHeight: '100vh',
      background: palette.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter Tight, sans-serif',
      color: palette.ink,
    }}>
      {/* Slim header */}
      <header style={{
        padding: '20px 22px 14px',
        borderBottom: `1px solid ${palette.borderSoft}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{
            fontFamily: 'Fraunces, serif',
            fontSize: '1.5rem',
            fontWeight: 400,
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1,
            fontVariationSettings: "'SOFT' 100, 'opsz' 144",
          }}>align</h1>
          <span style={{
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            fontSize: '0.78rem',
            color: palette.ink3,
          }}>capture</span>
        </div>
        <a
          href="/"
          style={{
            color: palette.ink3,
            fontSize: '0.7rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Full Align <ArrowUpRight size={11} />
        </a>
      </header>

      {/* Capture area — text input grows to fill */}
      <main style={{ flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <textarea
          ref={inputRef}
          value={text + (interimText ? ' ' + interimText : '')}
          onChange={(e) => { setText(e.target.value); setInterimText(''); }}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
          placeholder='Dinner with Sarah Tuesday 7pm. Or just a thought.'
          style={{
            flex: 1,
            minHeight: 180,
            width: '100%',
            border: `1px solid ${listening ? palette.accent : palette.border}`,
            borderRadius: 10,
            padding: 14,
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '1rem',
            lineHeight: 1.45,
            color: interimText ? palette.ink3 : palette.ink,
            resize: 'none',
            outline: 'none',
            background: palette.bg,
            transition: 'border-color 0.2s',
            opacity: isBusy ? 0.6 : 1,
          }}
        />

        {/* Status banner */}
        {status && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.85rem',
              background:
                status.kind === 'success-event' || status.kind === 'success-brain' ? palette.accentSoft :
                status.kind === 'error' ? palette.errBg :
                palette.bgRaised,
              color:
                status.kind === 'success-event' || status.kind === 'success-brain' ? palette.accent :
                status.kind === 'error' ? palette.errInk :
                palette.ink2,
              border: `1px solid ${status.kind === 'error' ? palette.errInk + '30' : palette.borderSoft}`,
            }}
          >
            {status.kind === 'success-event' && <Calendar size={14} />}
            <span style={{ flex: 1 }}>{status.message}</span>
            {status.kind === 'success-event' && status.link && (
              <a
                href={status.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: palette.accent, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.78rem' }}
              >
                View <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {error && (
          <p style={{ fontSize: '0.78rem', color: palette.errInk, margin: 0 }}>{error}</p>
        )}
      </main>

      {/* Action row pinned bottom */}
      <footer style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))',
        borderTop: `1px solid ${palette.borderSoft}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: palette.bgRaised,
      }}>
        <button
          onClick={listening ? stopListening : startListening}
          disabled={!speechSupported.current || isBusy}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: 999,
            border: `1px solid ${listening ? palette.accent : palette.border}`,
            background: listening ? palette.accent : 'transparent',
            color: listening ? 'white' : palette.ink2,
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: speechSupported.current && !isBusy ? 1 : 0.4,
            cursor: speechSupported.current && !isBusy ? 'pointer' : 'not-allowed',
            touchAction: 'manipulation',
          }}
        >
          {listening ? (<><MicOff size={16} /> Stop</>) : (<><Mic size={16} /> Voice</>)}
        </button>

        <button
          onClick={submit}
          disabled={!text.trim() || isBusy}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: 999,
            border: 'none',
            background: text.trim() && !isBusy ? palette.accent : palette.border,
            color: text.trim() && !isBusy ? 'white' : palette.ink3,
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: text.trim() && !isBusy ? 'pointer' : 'not-allowed',
            touchAction: 'manipulation',
          }}
        >
          <Send size={16} /> {isBusy ? 'Working…' : 'Save'}
        </button>
      </footer>
    </div>
  );
}
