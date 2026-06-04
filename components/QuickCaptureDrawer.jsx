'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Send, Brain } from 'lucide-react';

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
};

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function QuickCaptureDrawer({ open, onClose, onCapture }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
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
    if (!value) return;
    await onCapture(value);
    setText('');
    setInterimText('');
    onClose();
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
            <button onClick={onClose} className="p-1 hover:bg-black/[0.04] rounded" style={{ color: palette.ink2 }}>
              <X size={16} />
            </button>
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
              className="w-full bg-transparent outline-none text-[15px] leading-relaxed resize-none"
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
              disabled={!text.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-full transition-all"
              style={{
                background: text.trim() ? palette.accent : palette.border,
                color: text.trim() ? 'white' : palette.ink3,
                border: 'none',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: text.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={13} /> Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
