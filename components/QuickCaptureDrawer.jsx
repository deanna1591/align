'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Send, Brain, Calendar, ExternalLink } from 'lucide-react';

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

export default function QuickCaptureDrawer({ open, onClose, onCapture, onCreateEvent }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [interimText, setInterimText] = useState('');
  // Status of the smart submit flow.
  //   null            — idle
  //   { kind: 'processing', message }
  //   { kind: 'success', message, link? }
  //   { kind: 'error', message }
  const [status, setStatus] = useState(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const speechSupported = useRef(false);

  useEffect(() => {
    speechSupported.current = !!getSpeechRecognition();
  }, []);

  useEffect(() => {
    if (open) {
      setText('');
      setInterimText('');
      setError(null);
      setStatus(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
    setInterimText('');
  };

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Voice input not supported in this browser. Use Chrome or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalChunk += result[0].transcript;
          else interimChunk += result[0].transcript;
        }
        if (finalChunk) {
          setText(prev => (prev + ' ' + finalChunk).trim());
          setInterimText('');
        } else {
          setInterimText(interimChunk);
        }
      };

      recognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setError('Microphone permission denied. Enable it in browser settings.');
        } else if (e.error === 'no-speech') {
          // silent
        } else {
          setError(`Mic error: ${e.error}`);
        }
        stopListening();
      };

      recognition.onend = () => {
        setListening(false);
        setInterimText('');
      };

      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      setError(null);
    } catch (e) {
      setError(`Could not start mic: ${e.message}`);
    }
  };

  const friendlyDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Submit flow:
  //   1. Stop listening, freeze input.
  //   2. Send text to /api/parse-task (Claude).
  //   3. If parsed as event → onCreateEvent(parsed) (creates Google event + Align task).
  //      Else → onCapture(text) (brain dump fallback).
  //   4. Show success toast briefly, then auto-close.
  //   5. On error, stay open with red message so user can fix or fall back.
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    if (status?.kind === 'processing') return; // de-dupe double-submit

    stopListening();
    setStatus({ kind: 'processing', message: 'Reading your note…' });

    let parsed = null;
    try {
      const tz = typeof Intl !== 'undefined'
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
      console.error('[Align] parse-task error:', err);
      // fall through — treat as brain dump
    }

    if (parsed?.is_event && parsed.date && typeof onCreateEvent === 'function') {
      try {
        setStatus({ kind: 'processing', message: 'Adding to your calendar…' });
        const result = await onCreateEvent(parsed);
        const calLabel = result?.label || 'Google';
        setStatus({
          kind: 'success',
          message: `Added to ${calLabel} calendar · ${friendlyDate(parsed.date)}`,
          link: result?.html_link,
        });
        setTimeout(() => {
          setText('');
          setInterimText('');
          setStatus(null);
          onClose();
        }, 1600);
      } catch (err) {
        console.error('[Align] create-event error:', err);
        setStatus({
          kind: 'error',
          message: `Couldn't create event: ${err.message || 'unknown'}. Saved to brain dump instead.`,
        });
        try { await onCapture(value); } catch {}
      }
    } else {
      try {
        await onCapture(value);
        setStatus({ kind: 'success', message: 'Captured to brain dump' });
        setTimeout(() => {
          setText('');
          setInterimText('');
          setStatus(null);
          onClose();
        }, 900);
      } catch (err) {
        setStatus({ kind: 'error', message: `Save failed: ${err.message || 'unknown'}` });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') onClose();
  };

  const isBusy = status?.kind === 'processing';

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          background: 'rgba(27,24,19,0.20)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={isBusy ? undefined : onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform"
        style={{
          background: palette.bgRaised,
          borderTop: `1px solid ${palette.border}`,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transitionDuration: '320ms',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 32px rgba(27,24,19,0.10)',
        }}
      >
        <div className="max-w-[680px] mx-auto px-5 pt-5 pb-6">
          <div
            className="mx-auto mb-4 rounded-full"
            style={{ width: 40, height: 4, background: palette.border }}
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain size={14} style={{ color: palette.accent }} />
              <h2 style={{
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: palette.ink2,
              }}>
                Quick capture
              </h2>
            </div>
            <button onClick={onClose} disabled={isBusy} className="p-1 hover:bg-black/[0.04] rounded" style={{ color: palette.ink2 }}>
              <X size={16} />
            </button>
          </div>

          <div
            className="rounded-lg p-3 mb-3"
            style={{
              background: palette.bg,
              border: `1px solid ${listening ? palette.accent : palette.border}`,
              transition: 'border-color 0.2s',
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            <textarea
              ref={inputRef}
              value={text + (interimText ? ' ' + interimText : '')}
              onChange={(e) => {
                setText(e.target.value);
                setInterimText('');
              }}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              placeholder={listening ? 'Listening…' : 'Tell me what you have to do, e.g. "dinner with Sarah Tuesday 7pm"'}
              rows={3}
              className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none"
              style={{
                fontFamily: 'Inter Tight, sans-serif',
                color: interimText ? palette.ink3 : palette.ink,
              }}
            />
          </div>

          {/* Status banner: processing / success / error */}
          {status && (
            <div
              className="mb-3 px-3 py-2 rounded flex items-center gap-2"
              style={{
                background:
                  status.kind === 'success' ? palette.accentSoft :
                  status.kind === 'error' ? palette.errBg :
                  palette.bgRaised,
                color:
                  status.kind === 'success' ? palette.accent :
                  status.kind === 'error' ? palette.errInk :
                  palette.ink2,
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.78rem',
                border: `1px solid ${status.kind === 'error' ? palette.errInk + '30' : palette.borderSoft}`,
              }}
            >
              {status.kind === 'success' && <Calendar size={13} />}
              <span style={{ flex: 1 }}>{status.message}</span>
              {status.kind === 'success' && status.link && (
                <a
                  href={status.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: palette.accent, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                >
                  View <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}

          {error && (
            <p style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.75rem',
              color: palette.errInk,
              marginBottom: 10,
            }}>{error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!speechSupported.current || isBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-full transition-all"
              style={{
                background: listening ? palette.accent : 'transparent',
                color: listening ? 'white' : palette.ink2,
                border: `1px solid ${listening ? palette.accent : palette.border}`,
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.8rem',
                fontWeight: 500,
                opacity: speechSupported.current && !isBusy ? 1 : 0.4,
                cursor: speechSupported.current && !isBusy ? 'pointer' : 'not-allowed',
              }}
            >
              {listening ? (<><MicOff size={13} /> Stop</>) : (<><Mic size={13} /> {speechSupported.current ? 'Voice' : 'No mic'}</>)}
            </button>

            <div className="flex items-center gap-2" style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.7rem',
              color: palette.ink3,
            }}>
              <kbd style={{
                padding: '1px 5px',
                borderRadius: 3,
                border: `1px solid ${palette.border}`,
                background: palette.bg,
              }}>↵</kbd>
              <span>to save</span>
            </div>

            <button
              onClick={submit}
              disabled={!text.trim() || isBusy}
              className="flex items-center gap-2 px-5 py-2 rounded-full transition-all"
              style={{
                background: text.trim() && !isBusy ? palette.accent : palette.border,
                color: text.trim() && !isBusy ? 'white' : palette.ink3,
                border: 'none',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: text.trim() && !isBusy ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={13} /> {isBusy ? 'Working…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
