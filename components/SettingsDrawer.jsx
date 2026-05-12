'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, Check, ExternalLink } from 'lucide-react';
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
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('Personal');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from('calendar_feeds')
      .select('id, label, ics_url, created_at')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Align] Load feeds error:', error);
          setNotice({ kind: 'error', text: error.message });
        }
        setFeeds(data || []);
        setLoading(false);
      });
  }, [open, user]);

  const addFeed = async () => {
    if (!newUrl.trim() || !newLabel.trim()) return;
    const url = newUrl.trim();

    // Basic validation: must look like an https URL with .ics or "ical" in the path
    if (!/^https?:\/\//i.test(url)) {
      setNotice({ kind: 'error', text: 'URL must start with https://' });
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('calendar_feeds')
      .insert({ user_id: user.id, label: newLabel.trim(), ics_url: url })
      .select()
      .single();

    if (error) {
      setNotice({ kind: 'error', text: error.message });
      return;
    }
    setFeeds((prev) => [...prev, data]);
    setNewUrl('');
    setNewLabel('Personal');
    setAdding(false);
    setNotice({ kind: 'success', text: `Added ${data.label} feed` });
  };

  const removeFeed = async (id, label) => {
    if (!confirm(`Remove "${label}" feed?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('calendar_feeds').delete().eq('id', id);
    if (error) {
      setNotice({ kind: 'error', text: error.message });
      return;
    }
    setFeeds((prev) => prev.filter((f) => f.id !== id));
    setNotice({ kind: 'success', text: `Removed ${label}` });
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.85rem',
    color: palette.ink,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: '6px',
    outline: 'none',
  };

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
          width: 460,
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
              Connect calendar feeds.
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
                Calendar feeds
              </h3>
            </div>

            {loading ? (
              <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.9rem', color: palette.ink3 }}>
                Loading…
              </p>
            ) : (
              <>
                {feeds.length === 0 && (
                  <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink3, marginBottom: 12, lineHeight: 1.5 }}>
                    No feeds connected. Paste an iCal URL from Google Calendar to see your events.
                  </p>
                )}

                <ul className="space-y-2 mb-4">
                  {feeds.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded"
                      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
                    >
                      <Check size={13} style={{ color: palette.accent, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink, fontWeight: 500 }}>
                          {f.label}
                        </div>
                        <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.ics_url}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFeed(f.id, f.label)}
                        className="p-1 hover:opacity-100 opacity-50 transition-opacity"
                        style={{ color: palette.ink3 }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>

                {adding ? (
                  <div className="space-y-2 mb-4 p-3 rounded" style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
                    <div>
                      <label style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.ink2 }}>
                        Label
                      </label>
                      <select
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        style={{ ...inputStyle, marginTop: 4 }}
                      >
                        <option value="Personal">Personal</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.ink2 }}>
                        iCal URL
                      </label>
                      <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                        autoFocus
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={addFeed}
                        className="px-4 py-1.5 rounded transition-colors"
                        style={{
                          background: palette.accent,
                          color: 'white',
                          fontFamily: 'Inter Tight, sans-serif',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          border: 'none',
                        }}
                      >
                        Add feed
                      </button>
                      <button
                        onClick={() => { setAdding(false); setNewUrl(''); }}
                        className="px-4 py-1.5"
                        style={{
                          background: 'transparent',
                          color: palette.ink2,
                          fontFamily: 'Inter Tight, sans-serif',
                          fontSize: '0.8rem',
                          border: 'none',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors mb-4"
                    style={{
                      background: 'transparent',
                      border: `1px dashed ${palette.accent}`,
                      color: palette.accent,
                      fontFamily: 'Inter Tight, sans-serif',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={13} /> Add a calendar feed
                  </button>
                )}

                <div
                  className="mt-6 p-4 rounded"
                  style={{ background: palette.bg, border: `1px solid ${palette.borderSoft}` }}
                >
                  <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: palette.ink2, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    How to get your iCal URL
                  </p>
                  <ol style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.78rem', color: palette.ink2, lineHeight: 1.6, paddingLeft: 18, listStyle: 'decimal' }}>
                    <li>Open <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{ color: palette.accent, textDecoration: 'underline' }}>Google Calendar <ExternalLink size={10} style={{ display: 'inline', marginLeft: 2 }} /></a> on desktop</li>
                    <li>Left sidebar → hover your calendar → three dots → <strong>Settings and sharing</strong></li>
                    <li>Scroll way down to <strong>Integrate calendar</strong></li>
                    <li>Copy the <strong>Secret address in iCal format</strong></li>
                    <li>Paste it here</li>
                  </ol>
                  <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink3, marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' }}>
                    Google refreshes this feed every few hours, so new events take a bit to appear. Treat the URL like a password — anyone with it can see your calendar.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
