'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Send, Brain } from 'lucide-react';

const palette = {
  bg: '#FFFFFF',
  bgRaised: '#FBF1FA',
  ink: '#4A2E7A',
  ink2: '#8B6FB8',
  ink3: '#B49ED6',
  border: '#B59BD8',
  borderSoft: '#ECE0F8',
  accent: '#FF5FB0',
  accentSoft: 'rgba(255,95,176,0.14)',
  warn: '#9B5CFF',
};

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function QuickCaptureDrawer({ open, onClose, onCapture, onCreateEvent }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [interimText, setInterimText] = useState('');
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
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      stopListening();
    }
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

  const submit = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    setError(null);

    // Ask the parser whether this is a scheduled event or just a note.
    const tz = typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let parsed = null;
    try {
      const res = await fetch('/api/parse-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, today: todayStr, user_timezone: tz }),
      });
      if (res.ok) parsed = await res.json();
    } catch {
      // parser unreachable — fall through to note below
    }

    try {
      if (parsed && parsed.type === 'event' && parsed.date && onCreateEvent) {
        // Calendar event: AlignApp creates the Google event and drops a task on the day.
        await onCreateEvent(parsed);
      } else {
        // Note / todo: goes to the brain dump.
        await onCapture(value);
      }
      setText('');
      setInterimText('');
      setSaving(false);
      onClose();
    } catch (e) {
      // Event creation failed (e.g. no write calendar / permission). Keep the
      // text so nothing is lost and show why.
      setSaving(false);
      setError(
        e?.message === 'no_write_capable_connection'
          ? 'No calendar is set to write to. Open Settings and pick a write calendar.'
          : `Couldn't add to calendar: ${e?.message || 'unknown error'}. Try again or save as a note.`
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          background: 'rgba(27,24,19,0.20)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform"
        style={{
          background: '#FFFDF9',
          borderTop: `2px solid ${palette.ink}`,
          borderLeft: `2px solid ${palette.ink}`,
          borderRight: `2px solid ${palette.ink}`,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transitionDuration: '320ms',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -4px 0 rgba(91,62,142,0.18)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#DAC4FF', borderBottom: `2px solid ${palette.ink}` }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FF6FB5', border: `1.5px solid ${palette.ink}` }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FCD93D', border: `1.5px solid ${palette.ink}` }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#9B5CFF', border: `1.5px solid ${palette.ink}` }} />
          </span>
          <span style={{ flex: 1, fontFamily: 'VT323, monospace', fontSize: '1.15rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: palette.ink }}>QUICK_CAPTURE.EXE</span>
          <button onClick={onClose} style={{ width: 18, height: 16, borderRadius: 2, border: `1.5px solid ${palette.ink}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: palette.ink }}><X size={11} /></button>
        </div>
        <div className="max-w-[680px] mx-auto px-5 pt-4 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={14} style={{ color: palette.accent }} />
            <h2 style={{
              fontFamily: 'VT323, monospace',
              fontSize: '1.15rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: palette.ink2,
            }}>
              Quick capture
            </h2>
          </div>

          <div
            className="rounded-lg p-3 mb-3"
            style={{
              background: palette.bg,
              border: `1px solid ${listening ? palette.accent : palette.border}`,
              transition: 'border-color 0.2s',
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
              placeholder={listening ? 'Listening...' : "What's on your mind?"}
              rows={3}
              className="w-full bg-transparent outline-none text-[0.9375rem] leading-relaxed resize-none"
              style={{
                fontFamily: 'Inter Tight, sans-serif',
                color: interimText ? palette.ink3 : palette.ink,
              }}
            />
          </div>

          {error && (
            <p style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.75rem',
              color: '#8C3A2A',
              marginBottom: 10,
            }}>{error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!speechSupported.current}
              className="flex items-center gap-2 px-4 py-2 rounded-full transition-all"
              style={{
                background: listening ? palette.accent : 'transparent',
                color: listening ? 'white' : palette.ink2,
                border: `1px solid ${listening ? palette.accent : palette.border}`,
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.8rem',
                fontWeight: 500,
                opacity: speechSupported.current ? 1 : 0.4,
                cursor: speechSupported.current ? 'pointer' : 'not-allowed',
              }}
            >
              {listening ? (
                <>
                  <MicOff size={13} /> Stop
                </>
              ) : (
                <>
                  <Mic size={13} /> {speechSupported.current ? 'Voice' : 'No mic'}
                </>
              )}
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
              disabled={!text.trim() || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-full transition-all"
              style={{
                background: text.trim() && !saving ? palette.accent : palette.border,
                color: text.trim() && !saving ? 'white' : palette.ink3,
                border: 'none',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: text.trim() && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
