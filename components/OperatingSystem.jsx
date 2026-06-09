'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Target, Trash2, Plus, Check, ArrowRight, Lightbulb,
  Scale, RefreshCw, ChevronDown, ChevronRight, Archive, X,
} from 'lucide-react';
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
  accentSofter: 'rgba(124,164,129,0.05)',
  warm: '#C9824A',
  warmSoft: 'rgba(201,130,74,0.10)',
  errBg: '#FBE9E5',
  errInk: '#8C3A2A',
  softShadow: '0 1px 14px rgba(0, 0, 0, 0.04)',
};

const newId = (p = 'o') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

const LANES = [
  { key: 'personal', label: 'Personal' },
  { key: 'work', label: 'RemoteGenies' },
  { key: 'team', label: 'Leadership / Team' },
];

const CATEGORIES = [
  { key: 'business', label: 'Business' },
  { key: 'remotegenies', label: 'RemoteGenies' },
  { key: 'travel', label: 'Travel' },
  { key: 'family', label: 'Family' },
  { key: 'insight', label: 'Insight' },
  { key: 'idea', label: 'Idea' },
];

const DELEGATE_DECISIONS = [
  { key: 'delegate', label: 'Delegate' },
  { key: 'automate', label: 'Automate' },
  { key: 'document', label: 'Document' },
  { key: 'eliminate', label: 'Eliminate' },
];

// Shared section shell ---------------------------------------------------------
function Section({ icon, title, subtitle, accent, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 14,
      boxShadow: palette.softShadow,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 18px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: accent || palette.accentSoft, color: palette.accent,
        }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{
            display: 'block', fontFamily: 'Fraunces, serif', fontSize: '1.05rem',
            color: palette.ink, fontVariationSettings: "'opsz' 144", lineHeight: 1.2,
          }}>{title}</span>
          {subtitle && (
            <span style={{
              display: 'block', fontFamily: 'Inter Tight, sans-serif',
              fontSize: '0.76rem', color: palette.ink3, marginTop: 2,
            }}>{subtitle}</span>
          )}
        </span>
        <span style={{ color: palette.ink3, flexShrink: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </section>
  );
}

const inputStyle = {
  width: '100%', border: `1px solid ${palette.border}`, borderRadius: 8,
  padding: '10px 12px', fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem',
  color: palette.ink, outline: 'none', background: palette.bg,
};

const chipStyle = (active) => ({
  padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 500,
  fontFamily: 'Inter Tight, sans-serif', cursor: 'pointer',
  border: `1px solid ${active ? palette.accent : palette.border}`,
  background: active ? palette.accent : 'transparent',
  color: active ? 'white' : palette.ink2, whiteSpace: 'nowrap',
});

// =============================================================================
export default function OperatingSystem({ userId }) {
  const supabase = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [bigThree, setBigThree] = useState([]);
  const [opps, setOpps] = useState([]);
  const [delegates, setDelegates] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [review, setReview] = useState(null);

  const todayKey = ymd(new Date());
  const weekStartKey = ymd(mondayOf(new Date()));

  // ---- load -----------------------------------------------------------------
  const loadAll = useCallback(async () => {
    if (!supabase.current || !userId) return;
    const sb = supabase.current;
    try {
      const [bt, op, dl, dc, wr] = await Promise.all([
        sb.from('big_three').select('*').eq('user_id', userId).eq('date', todayKey),
        sb.from('opportunities').select('*').eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false }),
        sb.from('delegate_items').select('*').eq('user_id', userId).eq('done', false).order('created_at', { ascending: false }),
        sb.from('decisions').select('*').eq('user_id', userId).order('decided_at', { ascending: false }),
        sb.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', weekStartKey).maybeSingle(),
      ]);
      setBigThree(bt.data || []);
      setOpps(op.data || []);
      setDelegates(dl.data || []);
      setDecisions(dc.data || []);
      setReview(wr.data || null);
    } catch (e) {
      console.error('[OS] load error:', e);
    } finally {
      setLoaded(true);
    }
  }, [userId, todayKey, weekStartKey]);

  useEffect(() => {
    supabase.current = createClient();
    loadAll();
  }, [loadAll]);

  // Refetch on focus so cross-device edits show up.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadAll);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadAll);
    };
  }, [loadAll]);

  const sb = () => supabase.current;

  // ---- Big Three ------------------------------------------------------------
  const setBigWin = async (lane, text) => {
    const trimmed = text.trim();
    const existing = bigThree.find(b => b.lane === lane);
    if (existing) {
      if (!trimmed) return removeBigWin(existing.id);
      setBigThree(prev => prev.map(b => b.id === existing.id ? { ...b, text: trimmed } : b));
      await sb().from('big_three').update({ text: trimmed }).eq('id', existing.id);
    } else {
      if (!trimmed) return;
      const row = { id: newId('bw'), user_id: userId, date: todayKey, lane, text: trimmed, completed: false };
      setBigThree(prev => [...prev, row]);
      await sb().from('big_three').insert(row);
    }
  };
  const toggleBigWin = async (id) => {
    const item = bigThree.find(b => b.id === id);
    if (!item) return;
    setBigThree(prev => prev.map(b => b.id === id ? { ...b, completed: !b.completed } : b));
    await sb().from('big_three').update({ completed: !item.completed }).eq('id', id);
  };
  const removeBigWin = async (id) => {
    setBigThree(prev => prev.filter(b => b.id !== id));
    await sb().from('big_three').delete().eq('id', id);
  };

  // ---- Opportunities --------------------------------------------------------
  const addOpp = async (text, category) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const row = { id: newId('op'), user_id: userId, text: trimmed, category, archived: false, created_at: new Date().toISOString() };
    setOpps(prev => [row, ...prev]);
    await sb().from('opportunities').insert({ id: row.id, user_id: userId, text: trimmed, category });
  };
  const archiveOpp = async (id) => {
    setOpps(prev => prev.filter(o => o.id !== id));
    await sb().from('opportunities').update({ archived: true }).eq('id', id);
  };
  const deleteOpp = async (id) => {
    setOpps(prev => prev.filter(o => o.id !== id));
    await sb().from('opportunities').delete().eq('id', id);
  };

  // ---- Delegate -------------------------------------------------------------
  const addDelegate = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const row = { id: newId('dl'), user_id: userId, text: trimmed, decision: null, who: null, done: false, created_at: new Date().toISOString() };
    setDelegates(prev => [row, ...prev]);
    await sb().from('delegate_items').insert({ id: row.id, user_id: userId, text: trimmed });
  };
  const setDelegateDecision = async (id, decision) => {
    setDelegates(prev => prev.map(d => d.id === id ? { ...d, decision } : d));
    await sb().from('delegate_items').update({ decision }).eq('id', id);
  };
  const completeDelegate = async (id) => {
    setDelegates(prev => prev.filter(d => d.id !== id));
    await sb().from('delegate_items').update({ done: true }).eq('id', id);
  };
  const deleteDelegate = async (id) => {
    setDelegates(prev => prev.filter(d => d.id !== id));
    await sb().from('delegate_items').delete().eq('id', id);
  };

  // ---- Decisions ------------------------------------------------------------
  const addDecision = async ({ title, reasoning, expected }) => {
    const t = title.trim();
    if (!t) return;
    const row = {
      id: newId('dc'), user_id: userId, title: t,
      reasoning: reasoning.trim() || null, expected: expected.trim() || null,
      outcome: null, decided_at: new Date().toISOString(), reviewed_at: null,
    };
    setDecisions(prev => [row, ...prev]);
    await sb().from('decisions').insert({
      id: row.id, user_id: userId, title: t,
      reasoning: row.reasoning, expected: row.expected,
    });
  };
  const reviewDecision = async (id, outcome) => {
    const o = outcome.trim();
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, outcome: o, reviewed_at: new Date().toISOString() } : d));
    await sb().from('decisions').update({ outcome: o, reviewed_at: new Date().toISOString() }).eq('id', id);
  };
  const deleteDecision = async (id) => {
    setDecisions(prev => prev.filter(d => d.id !== id));
    await sb().from('decisions').delete().eq('id', id);
  };

  // ---- Weekly review --------------------------------------------------------
  const saveReview = async (fields) => {
    const next = { ...(review || {}), ...fields };
    setReview(next);
    const payload = {
      id: review?.id || newId('wr'),
      user_id: userId,
      week_start: weekStartKey,
      energized: next.energized || null,
      drained: next.drained || null,
      biggest_impact: next.biggest_impact || null,
      delegate_next: next.delegate_next || null,
      opportunities: next.opportunities || null,
    };
    await sb().from('weekly_reviews').upsert(payload, { onConflict: 'user_id,week_start' });
  };

  if (!loaded) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'Fraunces, serif', fontStyle: 'italic', color: palette.ink3 }}>
        Loading your operating system…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
      {/* Flow banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        flexWrap: 'wrap', padding: '14px 16px', borderRadius: 12,
        background: palette.accentSofter, border: `1px solid ${palette.borderSoft}`,
      }}>
        {['Capture', 'Clarify', 'Delegate', 'Execute', 'Reflect'].map((step, i) => (
          <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'Inter Tight, sans-serif', fontSize: '0.72rem', fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.accent,
            }}>{step}</span>
            {i < 4 && <ArrowRight size={11} style={{ color: palette.ink3 }} />}
          </span>
        ))}
      </div>

      <BigThreeSection
        lanes={LANES} bigThree={bigThree}
        onSet={setBigWin} onToggle={toggleBigWin} onRemove={removeBigWin}
      />

      <OpportunitySection
        opps={opps} categories={CATEGORIES}
        onAdd={addOpp} onArchive={archiveOpp} onDelete={deleteOpp}
      />

      <DelegateSection
        delegates={delegates} decisions={DELEGATE_DECISIONS}
        onAdd={addDelegate} onDecide={setDelegateDecision}
        onComplete={completeDelegate} onDelete={deleteDelegate}
      />

      <DecisionSection
        decisions={decisions}
        onAdd={addDecision} onReview={reviewDecision} onDelete={deleteDecision}
      />

      <WeeklyReviewSection review={review} weekStartKey={weekStartKey} onSave={saveReview} />
    </div>
  );
}

// =============================================================================
//  SECTION 1 — The 3 Big Wins
// =============================================================================
function BigThreeSection({ lanes, bigThree, onSet, onToggle, onRemove }) {
  return (
    <Section
      icon={<Target size={16} />}
      title="The 3 Big Wins"
      subtitle="If you only did 3 things today, what moves your life forward?"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {lanes.map(lane => {
          const win = bigThree.find(b => b.lane === lane.key);
          return <BigWinRow key={lane.key} lane={lane} win={win} onSet={onSet} onToggle={onToggle} onRemove={onRemove} />;
        })}
      </div>
    </Section>
  );
}

function BigWinRow({ lane, win, onSet, onToggle, onRemove }) {
  const [draft, setDraft] = useState(win?.text || '');
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft(win?.text || ''); }, [win?.text]);

  const commit = () => { onSet(lane.key, draft); setEditing(false); };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 10, border: `1px solid ${palette.border}`,
      background: win?.completed ? palette.accentSofter : palette.bg,
    }}>
      <span style={{
        fontFamily: 'Inter Tight, sans-serif', fontSize: '0.66rem', fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.ink3,
        minWidth: 92, flexShrink: 0,
      }}>{lane.label}</span>

      {win && !editing ? (
        <>
          <button onClick={() => onToggle(win.id)} style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
            border: `1.5px solid ${win.completed ? palette.accent : palette.border}`,
            background: win.completed ? palette.accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {win.completed && <Check size={13} color="white" />}
          </button>
          <span
            onClick={() => setEditing(true)}
            style={{
              flex: 1, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.92rem',
              color: win.completed ? palette.ink3 : palette.ink, cursor: 'text',
              textDecoration: win.completed ? 'line-through' : 'none',
            }}
          >{win.text}</span>
          <button onClick={() => onRemove(win.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.ink3, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </>
      ) : (
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder={`One ${lane.label.toLowerCase()} win…`}
          style={{ ...inputStyle, border: 'none', padding: '2px 0', flex: 1 }}
          autoFocus={editing}
        />
      )}
    </div>
  );
}

// =============================================================================
//  SECTION 2 — Opportunity Vault
// =============================================================================
function OpportunitySection({ opps, categories, onAdd, onArchive, onDelete }) {
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState('idea');

  const grouped = categories.map(c => ({ ...c, items: opps.filter(o => o.category === c.key) }))
    .filter(g => g.items.length > 0);

  return (
    <Section
      icon={<Lightbulb size={16} />}
      title="Opportunity Vault"
      subtitle="Park ideas here. You're not allowed to act on them today."
    >
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onAdd(draft, cat); setDraft(''); } }}
            placeholder="Capture an idea…"
            style={inputStyle}
          />
          <button
            onClick={() => { onAdd(draft, cat); setDraft(''); }}
            disabled={!draft.trim()}
            style={{
              padding: '0 14px', borderRadius: 8, border: 'none', flexShrink: 0,
              background: draft.trim() ? palette.accent : palette.border,
              color: draft.trim() ? 'white' : palette.ink3, cursor: draft.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center',
            }}
          ><Plus size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {categories.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)} style={chipStyle(cat === c.key)}>{c.label}</button>
          ))}
        </div>

        {grouped.length === 0 ? (
          <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.88rem', color: palette.ink3, padding: '8px 0' }}>
            No ideas parked yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {grouped.map(group => (
              <div key={group.key}>
                <p style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: '0.66rem', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.ink3, marginBottom: 6,
                }}>{group.label} · {group.items.length}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.items.map(o => (
                    <div key={o.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                      borderRadius: 8, background: palette.bgRaised, border: `1px solid ${palette.borderSoft}`,
                    }}>
                      <span style={{ flex: 1, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.88rem', color: palette.ink, lineHeight: 1.4 }}>{o.text}</span>
                      <button onClick={() => onArchive(o.id)} title="Archive" style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.ink3, flexShrink: 0 }}>
                        <Archive size={13} />
                      </button>
                      <button onClick={() => onDelete(o.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.ink3, flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

// =============================================================================
//  SECTION 3 — Delegate List
// =============================================================================
function DelegateSection({ delegates, decisions, onAdd, onDecide, onComplete, onDelete }) {
  const [draft, setDraft] = useState('');
  return (
    <Section
      icon={<ArrowRight size={16} />}
      title="Delegate List"
      subtitle="Does this need your genius? If not — delegate, automate, document, eliminate."
    >
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onAdd(draft); setDraft(''); } }}
            placeholder="Something you keep doing that you shouldn't…"
            style={inputStyle}
          />
          <button
            onClick={() => { onAdd(draft); setDraft(''); }}
            disabled={!draft.trim()}
            style={{
              padding: '0 14px', borderRadius: 8, border: 'none', flexShrink: 0,
              background: draft.trim() ? palette.accent : palette.border,
              color: draft.trim() ? 'white' : palette.ink3, cursor: draft.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center',
            }}
          ><Plus size={16} /></button>
        </div>

        {delegates.length === 0 ? (
          <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.88rem', color: palette.ink3, padding: '8px 0' }}>
            Nothing to offload right now.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {delegates.map(d => (
              <div key={d.id} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}`, background: palette.bg }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.9rem', color: palette.ink, lineHeight: 1.4 }}>{d.text}</span>
                  <button onClick={() => onComplete(d.id)} title="Mark handled" style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${palette.border}`, background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.accent,
                  }}><Check size={13} /></button>
                  <button onClick={() => onDelete(d.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.ink3, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {decisions.map(dec => (
                    <button key={dec.key} onClick={() => onDecide(d.id, dec.key)} style={chipStyle(d.decision === dec.key)}>
                      {dec.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

// =============================================================================
//  SECTION 4 — Decision Journal
// =============================================================================
function DecisionSection({ decisions, onAdd, onReview, onDelete }) {
  const [title, setTitle] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [expected, setExpected] = useState('');
  const [showForm, setShowForm] = useState(false);

  const submit = () => {
    onAdd({ title, reasoning, expected });
    setTitle(''); setReasoning(''); setExpected(''); setShowForm(false);
  };

  return (
    <Section
      icon={<Scale size={16} />}
      title="Decision Journal"
      subtitle="Log the big calls and your reasoning. Review the outcome later."
      defaultOpen={false}
    >
      <div style={{ marginTop: 4 }}>
        {!showForm ? (
          <button onClick={() => setShowForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
            border: `1px dashed ${palette.border}`, background: 'transparent', cursor: 'pointer',
            color: palette.ink2, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', marginBottom: 14,
          }}><Plus size={14} /> Log a decision</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, padding: 12, borderRadius: 10, background: palette.bgRaised, border: `1px solid ${palette.borderSoft}` }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="The decision…" style={inputStyle} autoFocus />
            <textarea value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Why I'm making it…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <textarea value={expected} onChange={e => setExpected(e.target.value)} placeholder="What I expect to happen…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={!title.trim()} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: title.trim() ? palette.accent : palette.border,
                color: title.trim() ? 'white' : palette.ink3, cursor: title.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem', fontWeight: 500,
              }}>Save</button>
              <button onClick={() => setShowForm(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${palette.border}`,
                background: 'transparent', color: palette.ink2, cursor: 'pointer',
                fontFamily: 'Inter Tight, sans-serif', fontSize: '0.85rem',
              }}>Cancel</button>
            </div>
          </div>
        )}

        {decisions.length === 0 ? (
          <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.88rem', color: palette.ink3, padding: '4px 0' }}>
            No decisions logged yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {decisions.map(d => <DecisionCard key={d.id} d={d} onReview={onReview} onDelete={onDelete} />)}
          </div>
        )}
      </div>
    </Section>
  );
}

function DecisionCard({ d, onReview, onDelete }) {
  const [outcomeDraft, setOutcomeDraft] = useState('');
  const [reviewing, setReviewing] = useState(false);
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${palette.border}`, background: palette.bg }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontFamily: 'Fraunces, serif', fontSize: '0.98rem', color: palette.ink, fontVariationSettings: "'opsz' 144" }}>{d.title}</span>
        <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.68rem', color: palette.ink3, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {new Date(d.decided_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button onClick={() => onDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette.ink3, flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>
      {d.reasoning && <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.82rem', color: palette.ink2, marginTop: 6, lineHeight: 1.4 }}><b style={{ color: palette.ink3, fontWeight: 600 }}>Why: </b>{d.reasoning}</p>}
      {d.expected && <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.82rem', color: palette.ink2, marginTop: 4, lineHeight: 1.4 }}><b style={{ color: palette.ink3, fontWeight: 600 }}>Expected: </b>{d.expected}</p>}

      {d.outcome ? (
        <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: '0.82rem', color: palette.accent, marginTop: 6, lineHeight: 1.4, padding: '8px 10px', background: palette.accentSofter, borderRadius: 8 }}>
          <b style={{ fontWeight: 600 }}>Outcome: </b>{d.outcome}
        </p>
      ) : reviewing ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={outcomeDraft} onChange={e => setOutcomeDraft(e.target.value)} placeholder="What actually happened…" style={inputStyle}
            onKeyDown={e => { if (e.key === 'Enter' && outcomeDraft.trim()) { onReview(d.id, outcomeDraft); setReviewing(false); } }} autoFocus />
          <button onClick={() => { if (outcomeDraft.trim()) { onReview(d.id, outcomeDraft); setReviewing(false); } }} style={{
            padding: '0 14px', borderRadius: 8, border: 'none', background: palette.accent, color: 'white', cursor: 'pointer', flexShrink: 0,
          }}><Check size={15} /></button>
        </div>
      ) : (
        <button onClick={() => setReviewing(true)} style={{
          marginTop: 8, fontFamily: 'Inter Tight, sans-serif', fontSize: '0.76rem', color: palette.warm,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>+ Add outcome</button>
      )}
    </div>
  );
}

// =============================================================================
//  SECTION 5 — Weekly CEO Review
// =============================================================================
function WeeklyReviewSection({ review, weekStartKey, onSave }) {
  const QUESTIONS = [
    { key: 'energized', q: 'What energized me?' },
    { key: 'drained', q: 'What drained me?' },
    { key: 'biggest_impact', q: 'What created the biggest impact?' },
    { key: 'delegate_next', q: 'What should I delegate next week?' },
    { key: 'opportunities', q: 'What opportunities am I seeing?' },
  ];
  const weekLabel = new Date(weekStartKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <Section
      icon={<RefreshCw size={16} />}
      title="Weekly CEO Review"
      subtitle={`Your Friday meeting with yourself · week of ${weekLabel}`}
      defaultOpen={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
        {QUESTIONS.map(({ key, q }) => (
          <ReviewQuestion key={key} q={q} value={review?.[key] || ''} onSave={(val) => onSave({ [key]: val })} />
        ))}
      </div>
    </Section>
  );
}

function ReviewQuestion({ q, value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div>
      <label style={{
        display: 'block', fontFamily: 'Fraunces, serif', fontStyle: 'italic',
        fontSize: '0.92rem', color: palette.ink2, marginBottom: 6, fontVariationSettings: "'opsz' 144",
      }}>{q}</label>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft); }}
        rows={2}
        placeholder="…"
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    </div>
  );
}
