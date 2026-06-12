'use client';

// components/UnshapedDaily.jsx
// "200 Things To Do Alone" — sequential daily prompt, reflections, and an
// auto-filling habit tracker. Self-contained: fetches its own progress rows.
// Day N is offered until completed; the tracker fills itself on save.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import { UNSHAPED } from '@/lib/unshaped-entries';

const C = {
  ink: '#36215C', ink2: '#6E5499', ink3: '#9F88C9',
  border: '#C9B8E6', borderSoft: '#ECE0F8',
  accent: '#FF5FB0', warm: '#9B5CFF', sun: '#FCD93D',
  card: '#FFFDF9',
  shadow: '2px 2px 0 rgba(54,33,92,0.16)',
  shadowStrong: '4px 4px 0 rgba(54,33,92,0.20)',
};
const NAME = 'Deanna';

const todayYmd = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function streakFrom(rows) {
  const days = new Set(
    rows.filter(r => r.status === 'done' && r.completed_at)
      .map(r => new Date(r.completed_at)).map(d => {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      }),
  );
  let streak = 0;
  const cur = new Date();
  // streak may start today or yesterday
  const p = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (!days.has(key(cur))) cur.setDate(cur.getDate() - 1);
  while (days.has(key(cur))) { streak += 1; cur.setDate(cur.getDate() - 1); }
  return streak;
}

const dot = (bg, b = C.ink) => ({ width: 10, height: 10, borderRadius: 999, background: bg, border: `1.5px solid ${b}` });
const vt = (size, color, extra = {}) => ({ fontFamily: 'VT323, monospace', fontSize: size, color, textTransform: 'uppercase', letterSpacing: '0.05em', ...extra });
const btn = (bg, color, extra = {}) => ({
  border: `2px solid ${C.ink}`, borderRadius: 8, boxShadow: C.shadow,
  fontFamily: 'Inter Tight, sans-serif', fontWeight: 600, fontSize: '0.78rem',
  padding: '7px 12px', cursor: 'pointer', background: bg, color, ...extra,
});

export default function UnshapedDaily({ userId }) {
  const [rows, setRows] = useState(null); // null = loading
  const [open, setOpen] = useState(false);      // reflection drawer
  const [more, setMore] = useState(false);      // why-this-works expand
  const [tracker, setTracker] = useState(false);// tracker overlay
  const [snoozed, setSnoozed] = useState(false);
  const [noticed, setNoticed] = useState('');
  const [felt, setFelt] = useState('');
  const [anything, setAnything] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try { setSnoozed(localStorage.getItem('unshaped_snooze') === todayYmd()); } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('unshaped_progress')
      .select('day, status, noticed, felt, anything, completed_at')
      .eq('user_id', userId)
      .order('day');
    if (!error) setRows(data || []);
    else setRows([]);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const doneDays = useMemo(() => new Set((rows || []).filter(r => r.status === 'done').map(r => r.day)), [rows]);
  const currentDay = useMemo(() => {
    for (let d = 1; d <= 200; d++) if (!doneDays.has(d)) return d;
    return null; // all 200 complete!
  }, [doneDays]);
  const entry = currentDay ? UNSHAPED[currentDay - 1] : null;
  const streak = useMemo(() => streakFrom(rows || []), [rows]);
  const waitingDays = useMemo(() => {
    if (!rows) return 0;
    const r = rows.find(x => x.day === currentDay);
    if (!r?.assigned_date) return 0;
    const diff = Math.floor((new Date(todayYmd()) - new Date(r.assigned_date)) / 86400000);
    return Math.max(0, diff);
  }, [rows, currentDay]);

  // Record when today's entry was first offered (for the gentle "still waiting" nudge).
  useEffect(() => {
    if (!userId || !rows || !currentDay) return;
    const existing = rows.find(r => r.day === currentDay);
    if (existing) return;
    const supabase = createClient();
    supabase.from('unshaped_progress')
      .upsert({ user_id: userId, day: currentDay, status: 'pending', assigned_date: todayYmd() }, { onConflict: 'user_id,day' })
      .then(() => {});
  }, [userId, rows, currentDay]);

  const save = async () => {
    if (saving) return;
    if (!noticed.trim() && !felt.trim() && !anything.trim()) {
      setErr('One sentence is plenty — but write something.');
      return;
    }
    setSaving(true); setErr('');
    const supabase = createClient();
    const { error } = await supabase.from('unshaped_progress').upsert({
      user_id: userId, day: currentDay, status: 'done',
      noticed: noticed.trim(), felt: felt.trim(), anything: anything.trim(),
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day' });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); setMore(false);
    setNoticed(''); setFelt(''); setAnything('');
    refresh(); // tracker auto-fills from the new row
  };

  const snooze = () => {
    try { localStorage.setItem('unshaped_snooze', todayYmd()); } catch {}
    setSnoozed(true);
  };

  if (!userId || rows === null) return null;

  // ----- all done -----
  if (!entry) {
    return (
      <div className="mb-4" style={{ background: C.card, border: `2px solid ${C.ink}`, borderRadius: 12, boxShadow: C.shadowStrong, padding: '14px 16px', textAlign: 'center' }}>
        <div style={vt('1.2rem', C.accent)}>200 / 200 — you did the whole book ✦</div>
      </div>
    );
  }

  const input16 = {
    width: '100%', fontFamily: 'Inter Tight, sans-serif', fontSize: 16, color: C.ink,
    background: '#FFFFFF', border: `2px solid ${C.border}`, borderRadius: 8,
    padding: '8px 10px', outline: 'none', resize: 'vertical', minHeight: 44,
  };
  const qLabel = { ...vt('0.92rem', C.ink3), margin: '10px 0 4px' };

  return (
    <>
      {/* ---------- BANNER ---------- */}
      {!snoozed && (
        <div className="mb-4" style={{ background: C.card, border: `2px solid ${C.ink}`, borderRadius: 12, boxShadow: C.shadowStrong, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', background: C.sun, borderBottom: `2px solid ${C.ink}` }}>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              <span style={dot('#FF6FB5')} /><span style={dot(C.warm)} />
            </span>
            <span style={{ flex: 1, ...vt('1.12rem', C.ink) }}>Try_today.exe</span>
            <button onClick={() => setTracker(true)} title="Open the tracker"
              style={{ ...vt('1rem', C.ink), background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {doneDays.size}/200{streak > 0 ? ` \u00B7 \uD83D\uDD25${streak}` : ''}
            </button>
          </div>
          <div style={{ padding: '12px 15px' }}>
            <div style={vt('0.98rem', C.accent)}>
              Hey {NAME} — try this today ✦ day {entry.day}
              {waitingDays > 0 && <span style={{ color: C.ink3 }}> · still waiting ({waitingDays + 1}d)</span>}
            </div>
            <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.95rem', fontWeight: 600, color: C.ink, margin: '5px 0 10px', lineHeight: 1.35 }}>
              {entry.title}
            </div>
            {more && (
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.8rem', color: C.ink2, lineHeight: 1.55, marginBottom: 10 }}>
                <p style={{ margin: '0 0 8px' }}>{entry.instructions}</p>
                <p style={{ margin: 0, color: C.ink3 }}><strong style={{ color: C.ink2 }}>Why this works.</strong> {entry.why}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => { setOpen(true); setErr(''); }} style={btn(C.accent, '#fff')}>I did it — reflect</button>
              <button onClick={() => setMore(m => !m)} style={btn('#fff', C.ink)}>{more ? 'less' : 'tell me more'}</button>
              <button onClick={snooze} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter Tight, sans-serif', fontSize: '0.75rem', color: C.ink3, textDecoration: 'underline', marginLeft: 'auto' }}>
                not today
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- REFLECTION DRAWER ---------- */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(54,33,92,0.32)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', background: C.card, border: `2px solid ${C.ink}`, borderTopLeftRadius: 14, borderTopRightRadius: 14, boxShadow: C.shadowStrong }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#DAC4FF', borderBottom: `2px solid ${C.ink}` }}>
              <span style={{ display: 'inline-flex', gap: 5 }}><span style={dot(C.warm)} /><span style={dot('#3FB8DE')} /></span>
              <span style={{ flex: 1, ...vt('1.1rem', C.ink) }}>Day_{entry.day} · reflect</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', ...vt('1.1rem', C.ink2) }}>✕</button>
            </div>
            <div style={{ padding: '14px 16px 18px' }}>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: C.ink, marginBottom: 6 }}>{entry.title}</div>
              <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.8rem', color: C.ink2, lineHeight: 1.55, margin: '0 0 8px' }}>{entry.instructions}</p>
              {entry.question && (
                <p style={{ fontFamily: 'Inter Tight, sans-serif', fontStyle: 'italic', fontSize: '0.8rem', color: C.ink3, margin: '0 0 4px' }}>{entry.question}</p>
              )}
              <div style={qLabel}>What did you notice?</div>
              <textarea value={noticed} onChange={(e) => setNoticed(e.target.value)} style={input16} autoFocus />
              <div style={qLabel}>What did you feel?</div>
              <textarea value={felt} onChange={(e) => setFelt(e.target.value)} style={input16} placeholder="one sentence is plenty" />
              <div style={qLabel}>Anything else?</div>
              <textarea value={anything} onChange={(e) => setAnything(e.target.value)} style={input16} />
              {err && <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.78rem', color: '#C0392B', margin: '10px 0 0' }}>{err}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={save} disabled={saving} style={btn(C.warm, '#fff', { opacity: saving ? 0.6 : 1 })}>
                  {saving ? 'saving…' : 'save · day done ✦'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- TRACKER + JOURNAL OVERLAY ---------- */}
      {tracker && (
        <div onClick={() => setTracker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(54,33,92,0.32)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', background: C.card, border: `2px solid ${C.ink}`, borderRadius: 14, boxShadow: C.shadowStrong }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FFB3DE', borderBottom: `2px solid ${C.ink}`, position: 'sticky', top: 0 }}>
              <span style={{ display: 'inline-flex', gap: 5 }}><span style={dot('#FF6FB5')} /><span style={dot(C.sun)} /><span style={dot(C.warm)} /></span>
              <span style={{ flex: 1, ...vt('1.1rem', C.ink) }}>Tracker.exe — {doneDays.size}/200{streak > 0 ? ` \u00B7 \uD83D\uDD25${streak}` : ''}</span>
              <button onClick={() => setTracker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', ...vt('1.1rem', C.ink2) }}>✕</button>
            </div>
            <div style={{ padding: '14px 16px 18px' }}>
              {/* the 200-pixel habit grid — fills automatically as days complete */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 3, marginBottom: 6 }}>
                {Array.from({ length: 200 }, (_, i) => {
                  const dnum = i + 1;
                  const done = doneDays.has(dnum);
                  const isCurrent = dnum === currentDay;
                  return (
                    <div key={dnum} title={`Day ${dnum}${done ? ' ✓' : isCurrent ? ' — today' : ''}`}
                      style={{
                        aspectRatio: '1', borderRadius: 2,
                        background: done ? C.accent : isCurrent ? C.sun : C.borderSoft,
                        border: `1px solid ${done ? C.accent : isCurrent ? C.ink : C.border}`,
                      }} />
                  );
                })}
              </div>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.68rem', color: C.ink3, marginBottom: 14 }}>
                pink = done · yellow = today · fills itself when you save a reflection
              </div>

              {/* journal of completed days, newest first */}
              <div style={vt('1rem', C.ink2, { marginBottom: 8 })}>Journal</div>
              {(rows || []).filter(r => r.status === 'done').sort((a, b) => b.day - a.day).map(r => {
                const e = UNSHAPED[r.day - 1];
                return (
                  <div key={r.day} style={{ border: `1.5px solid ${C.borderSoft}`, borderRadius: 8, padding: '8px 11px', marginBottom: 8, background: '#fff' }}>
                    <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: C.ink }}>
                      <span style={{ ...vt('0.85rem', C.ink3), marginRight: 6 }}>day {r.day}</span>{e?.title}
                    </div>
                    {r.noticed && <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.76rem', color: C.ink2, margin: '5px 0 0' }}><strong>noticed:</strong> {r.noticed}</p>}
                    {r.felt && <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.76rem', color: C.ink2, margin: '3px 0 0' }}><strong>felt:</strong> {r.felt}</p>}
                    {r.anything && <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.76rem', color: C.ink2, margin: '3px 0 0' }}><strong>else:</strong> {r.anything}</p>}
                  </div>
                );
              })}
              {doneDays.size === 0 && (
                <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.78rem', color: C.ink3 }}>Nothing here yet — day 1 is waiting for you.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
