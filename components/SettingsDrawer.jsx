'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

const palette = {
  bg: '#FFFFFF',
  bgRaised: '#FAFAFA',
  ink: '#1B1813',
  ink2: '#5C5448',
  ink3: '#9A917F',
  border: '#EAEAEA',
  borderSoft: '#F2F2F2',
  accent: '#7CA481',
  accentSoft: 'rgba(124,164,129,0.10)',
};

export default function SettingsDrawer({ open, onClose, user }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  // Check for query params on mount (success/error from OAuth callback)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('google_connected');
    const error = params.get('google_error');
    if (connected) {
      setNotice({ kind: 'success', text: `Connected ${connected}` });
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      setNotice({ kind: 'error', text: `Google error: ${decodeURIComponent(error)}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load connections when drawer opens
  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from('google_calendar_connections')
      .select('google_email, label, created_at')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Align] Load connections error:', error);
          setNotice({ kind: 'error', text: error.message });
        }
        setConnections(data || []);
        setLoading(false);
      });
  }, [open, user]);

  const connectGoogle = (label) => {
    window.location.href = `/auth/google/start?label=${encodeURIComponent(label)}`;
  };

  const disconnect = async (googleEmail) => {
    if (!confirm(`Disconnect ${googleEmail}?`)) return;
    const res = await fetch('/auth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_email: googleEmail }),
    });
    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.google_email !== googleEmail));
      setNotice({ kind: 'success', text: `Disconnected ${googleEmail}` });
    } else {
      const j = await res.json().catch(() => ({}));
      setNotice({ kind: 'error', text: j.error || 'Disconnect failed' });
    }
  };

  const hasPersonal = connections.some((c) => c.label === 'Personal');
  const hasWork = connections.some((c) => c.label === 'Work');

  return (
    <>
      <div
        className="fixed inset-0 z-30 transition-opacity"
        style={{
          background: 'rgba(27,24,19,0.15)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col transition-transform"
        style={{
          width: 420,
          maxWidth: '95vw',
          background: palette.bgRaised,
          borderLeft: `1px solid ${palette.border}`,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transitionDuration: '420ms',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${palette.borderSoft}` }}>
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: palette.ink, fontVariationSettings: "'opsz' 144", letterSpacing: '-0.02em' }}>
              Settings
            </h2>
            <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: palette.ink3, marginTop: 2 }}>
              Connect calendars and manage your account.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/[0.04] rounded" style={{ color: palette.ink2 }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {notice && (
            <div
              className="mb-4 px-3 py-2 rounded text-sm flex items-start gap-2"
              style={{
                background: notice.kind === 'success' ? palette.accentSoft : '#FBE9E5',
                color: notice.kind === 'success' ? palette.accent : '#8C3A2A',
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.8rem',
              }}
            >
              <span style={{ flex: 1 }}>{notice.text}</span>
              <button onClick={() => setNotice(null)}><X size={12} /></button>
            </div>
          )}

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} style={{ color: palette.accent }} />
              <h3 style={{
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: palette.ink2,
              }}>
                Google Calendars
              </h3>
            </div>

            {loading ? (
              <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.9rem', color: palette.ink3 }}>
                Loading…
              </p>
            ) : (
              <>
                {connections.length === 0 && (
                  <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink3, marginBottom: 12, lineHeight: 1.5 }}>
                    No calendars connected yet. Connect your personal and work Google accounts to see events alongside your tasks.
                  </p>
                )}

                <ul className="space-y-2 mb-4">
                  {connections.map((c) => (
                    <li
                      key={c.google_email}
                      className="flex items-center gap-3 px-3 py-2.5 rounded"
                      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
                    >
                      <Check size={13} style={{ color: palette.accent, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink, fontWeight: 500 }}>
                          {c.label}
                        </div>
                        <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: palette.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.google_email}
                        </div>
                      </div>
                      <button
                        onClick={() => disconnect(c.google_email)}
                        className="p-1 hover:opacity-100 opacity-50 transition-opacity"
                        style={{ color: palette.ink3 }}
                        title="Disconnect"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  {!hasPersonal && (
                    <button
                      onClick={() => connectGoogle('Personal')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${palette.accent}`,
                        color: palette.accent,
                        fontFamily: 'Inter Tight, sans-serif',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      <Plus size={13} /> Connect personal Google
                    </button>
                  )}
                  {!hasWork && (
                    <button
                      onClick={() => connectGoogle('Work')}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${palette.accent}`,
                        color: palette.accent,
                        fontFamily: 'Inter Tight, sans-serif',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      <Plus size={13} /> Connect work Google
                    </button>
                  )}
                  {hasPersonal && hasWork && (
                    <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.85rem', color: palette.ink3, textAlign: 'center', marginTop: 8 }}>
                      Both accounts connected.
                    </p>
                  )}
                </div>

                <p style={{
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: '0.7rem',
                  color: palette.ink3,
                  marginTop: 16,
                  lineHeight: 1.5,
                }}>
                  Note: connections expire after about 7 days. You'll need to reconnect periodically until we go through Google's app verification.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
