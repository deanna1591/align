'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, Check, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

// Mirrors CALENDAR_WRITE_SCOPE / CALENDAR_LIST_SCOPE from lib/google-oauth.js.
// Kept inline so the client bundle never imports server-only OAuth helpers.
const CALENDAR_WRITE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

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
  warn: '#C9824A',
  warnSoft: 'rgba(201,130,74,0.10)',
};

export default function SettingsDrawer({ open, onClose, user }) {
  // --- iCal feeds (unchanged) ---
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('Personal');
  const [newUrl, setNewUrl] = useState('');

  // --- Google connections ---
  const [googleConns, setGoogleConns] = useState([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [addingGoogle, setAddingGoogle] = useState(false);
  const [newGoogleLabel, setNewGoogleLabel] = useState('Personal');

  // --- Calendar lists per connection (Phase 3) ---
  // Shape: { [google_email]: { can_list, calendars: [{id, summary, primary}], reason, write_calendar_id } }
  const [calendarLists, setCalendarLists] = useState({});
  const [savingCalendar, setSavingCalendar] = useState({}); // { [email]: bool }

  // Shared notice surface
  const [notice, setNotice] = useState(null);

  // Load iCal feeds + Google connections + calendar lists on open
  useEffect(() => {
    if (!open || !user) return;
    const supabase = createClient();

    setLoading(true);
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

    setGoogleLoading(true);
    supabase
      .from('google_calendar_connections')
      .select('id, google_email, label, scopes, write_calendar_id, created_at')
      .eq('user_id', user.id)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Align] Load Google connections error:', error);
          setNotice({ kind: 'error', text: error.message });
        }
        setGoogleConns(data || []);
        setGoogleLoading(false);
      });

    // Calendar lists come from a server-side API since we need token refresh.
    fetch('/api/google/calendars')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.connections) return;
        const map = {};
        for (const c of data.connections) {
          map[c.google_email] = c;
        }
        setCalendarLists(map);
      })
      .catch((err) => console.error('[Align] Load calendar lists error:', err));
  }, [open, user]);

  // Surface OAuth redirect result, then clean the URL.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('google_connected');
    const error = params.get('google_error');
    if (connected) {
      setNotice({ kind: 'success', text: `Connected ${decodeURIComponent(connected)}` });
    } else if (error) {
      setNotice({ kind: 'error', text: `Google: ${decodeURIComponent(error)}` });
    }
    if (connected || error) {
      const url = new URL(window.location.href);
      url.searchParams.delete('google_connected');
      url.searchParams.delete('google_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [open]);

  // --- Google handlers ---

  const connectGoogle = (label) => {
    window.location.href = `/auth/google/start?label=${encodeURIComponent(label)}`;
  };

  const disconnectGoogle = async (googleEmail, label) => {
    if (!confirm(`Disconnect ${googleEmail}?`)) return;
    const res = await fetch('/auth/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_email: googleEmail }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNotice({ kind: 'error', text: body.error || 'Disconnect failed' });
      return;
    }
    setGoogleConns((prev) => prev.filter((c) => c.google_email !== googleEmail));
    setNotice({ kind: 'success', text: `Disconnected ${label}` });
  };

  // Save the user's write-calendar choice. RLS restricts updates to own rows.
  const saveWriteCalendar = async (googleEmail, calendarId) => {
    setSavingCalendar((s) => ({ ...s, [googleEmail]: true }));
    const supabase = createClient();
    const { error } = await supabase
      .from('google_calendar_connections')
      .update({ write_calendar_id: calendarId, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('google_email', googleEmail);
    setSavingCalendar((s) => ({ ...s, [googleEmail]: false }));
    if (error) {
      setNotice({ kind: 'error', text: error.message });
      return;
    }
    // Update both pieces of local state so the UI reflects the choice.
    setGoogleConns((prev) =>
      prev.map((c) => (c.google_email === googleEmail ? { ...c, write_calendar_id: calendarId } : c))
    );
    setCalendarLists((prev) => ({
      ...prev,
      [googleEmail]: prev[googleEmail] ? { ...prev[googleEmail], write_calendar_id: calendarId } : prev[googleEmail],
    }));
  };

  const hasWriteScope = (conn) =>
    Array.isArray(conn?.scopes) && conn.scopes.includes(CALENDAR_WRITE_SCOPE);

  // --- iCal handlers (unchanged) ---

  const addFeed = async () => {
    if (!newUrl.trim() || !newLabel.trim()) return;
    const url = newUrl.trim();
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

  // Non-blocking warning: same email connected via both Google and iCal feed.
  const duplicateEmails = (() => {
    const googleEmails = new Set(googleConns.map((c) => c.google_email.toLowerCase()));
    return feeds
      .map((f) => {
        const m = f.ics_url.match(/\/ical\/([^/]+)\//);
        if (!m) return null;
        const decoded = decodeURIComponent(m[1]).toLowerCase();
        return googleEmails.has(decoded) ? decoded : null;
      })
      .filter(Boolean);
  })();

  // --- Shared styles ---

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

  const calendarSelectStyle = {
    padding: '0.25rem 0.5rem',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.75rem',
    color: palette.ink,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: '4px',
    outline: 'none',
    cursor: 'pointer',
    maxWidth: '180px',
  };

  const sectionHeader = {
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: palette.ink2,
  };

  const subtleText = {
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.78rem',
    color: palette.ink3,
    lineHeight: 1.5,
  };

  const primaryBtn = {
    background: palette.accent,
    color: 'white',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: 'none',
    padding: '0.375rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
  };

  const badgeStyle = (color, bg) => ({
    display: 'inline-block',
    padding: '2px 8px',
    background: bg,
    color,
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderRadius: '10px',
  });

  const linkBtn = (color) => ({
    background: 'transparent',
    color,
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: '0.72rem',
    fontWeight: 500,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
  });

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

          {/* ============================================================
              GOOGLE CALENDAR
              ============================================================ */}
          <section style={{ marginBottom: 32 }}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={14} style={{ color: palette.accent }} />
              <h3 style={sectionHeader}>Google Calendar (recommended)</h3>
            </div>
            <p style={{ ...subtleText, marginBottom: 14 }}>
              Connect for two-way sync — write events to Google when you add tasks with a date and time.
            </p>

            {googleLoading ? (
              <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.9rem', color: palette.ink3 }}>
                Loading…
              </p>
            ) : (
              <>
                <ul className="space-y-2 mb-3">
                  {googleConns.map((conn) => {
                    const canWrite = hasWriteScope(conn);
                    const calInfo = calendarLists[conn.google_email];
                    const canListCalendars = calInfo?.can_list;
                    const calendars = calInfo?.calendars || [];
                    const isSaving = savingCalendar[conn.google_email];

                    return (
                      <li
                        key={conn.id}
                        className="flex items-start gap-3 px-3 py-2.5 rounded"
                        style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
                      >
                        <Check size={13} style={{ color: palette.accent, flexShrink: 0, marginTop: 3 }} />
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', color: palette.ink, fontWeight: 500 }}>
                            {conn.label}
                          </div>
                          <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', color: palette.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conn.google_email}
                          </div>

                          {/* Scope status */}
                          <div style={{ marginTop: 6 }}>
                            {canWrite ? (
                              <span style={badgeStyle(palette.accent, palette.accentSoft)}>Write enabled</span>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span style={badgeStyle(palette.warn, palette.warnSoft)}>Read only</span>
                                <button onClick={() => connectGoogle(conn.label)} style={linkBtn(palette.warn)}>
                                  <RefreshCw size={10} style={{ display: 'inline', marginRight: 3 }} />
                                  Reconnect to enable writing
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Calendar picker — only shown for connections that can write */}
                          {canWrite && (
                            <div style={{ marginTop: 8 }}>
                              {canListCalendars && calendars.length > 0 ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span style={{ ...subtleText, fontSize: '0.72rem' }}>Write new events to:</span>
                                  <select
                                    value={conn.write_calendar_id || 'primary'}
                                    onChange={(e) => saveWriteCalendar(conn.google_email, e.target.value)}
                                    disabled={isSaving}
                                    style={calendarSelectStyle}
                                  >
                                    {calendars.map((cal) => (
                                      <option key={cal.id} value={cal.id}>
                                        {cal.primary ? `Primary (${cal.summary})` : cal.summary}
                                      </option>
                                    ))}
                                  </select>
                                  {isSaving && <span style={{ ...subtleText, fontSize: '0.7rem' }}>Saving…</span>}
                                </div>
                              ) : calInfo === undefined ? (
                                <span style={{ ...subtleText, fontSize: '0.7rem', fontStyle: 'italic' }}>Loading calendars…</span>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span style={{ ...subtleText, fontSize: '0.72rem' }}>
                                    Always writes to primary calendar.
                                  </span>
                                  <button onClick={() => connectGoogle(conn.label)} style={linkBtn(palette.ink2)}>
                                    Reconnect to choose
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => disconnectGoogle(conn.google_email, conn.label)}
                          className="p-1 hover:opacity-100 opacity-50 transition-opacity"
                          style={{ color: palette.ink3 }}
                          title="Disconnect"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {duplicateEmails.length > 0 && (
                  <div
                    className="mb-3 px-3 py-2 rounded flex items-start gap-2"
                    style={{
                      background: palette.warnSoft,
                      color: palette.warn,
                      fontFamily: 'Inter Tight, sans-serif',
                      fontSize: '0.75rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      You have an iCal feed for {duplicateEmails.join(', ')}. Consider removing it below to avoid duplicate events.
                    </span>
                  </div>
                )}

                {addingGoogle ? (
                  <div className="space-y-2 mb-3 p-3 rounded" style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
                    <div>
                      <label style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.ink2 }}>
                        Label
                      </label>
                      <select
                        value={newGoogleLabel}
                        onChange={(e) => setNewGoogleLabel(e.target.value)}
                        style={{ ...inputStyle, marginTop: 4 }}
                      >
                        <option value="Personal">Personal</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => connectGoogle(newGoogleLabel)} style={primaryBtn}>
                        Continue to Google
                      </button>
                      <button
                        onClick={() => setAddingGoogle(false)}
                        style={{
                          background: 'transparent',
                          color: palette.ink2,
                          fontFamily: 'Inter Tight, sans-serif',
                          fontSize: '0.8rem',
                          border: 'none',
                          padding: '0.375rem 1rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <p style={{ ...subtleText, fontSize: '0.7rem', marginTop: 4 }}>
                      You'll be sent to Google to grant Align permission to view and edit events on your calendars.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingGoogle(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors"
                    style={{
                      background: 'transparent',
                      border: `1px dashed ${palette.accent}`,
                      color: palette.accent,
                      fontFamily: 'Inter Tight, sans-serif',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={13} /> {googleConns.length === 0 ? 'Connect Google Calendar' : 'Connect another account'}
                  </button>
                )}
              </>
            )}
          </section>

          {/* ============================================================
              iCAL FEEDS (unchanged)
              ============================================================ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} style={{ color: palette.ink2 }} />
              <h3 style={sectionHeader}>iCal feeds (read-only)</h3>
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
                      <button onClick={addFeed} style={primaryBtn}>
                        Add feed
                      </button>
                      <button
                        onClick={() => { setAdding(false); setNewUrl(''); }}
                        style={{
                          background: 'transparent',
                          color: palette.ink2,
                          fontFamily: 'Inter Tight, sans-serif',
                          fontSize: '0.8rem',
                          border: 'none',
                          padding: '0.375rem 1rem',
                          cursor: 'pointer',
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
