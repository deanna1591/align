'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles, Target, Trash2, Plus, Check, ArrowRight, Lightbulb,
  Scale, RefreshCw, Archive, X, Star, Heart,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

// Retro Y2K desktop palette ---------------------------------------------------
const C = {
  edge: '#5B3E8E',        // deep purple — borders + text
  ink: '#4A2E7A',
  ink2: '#8B6FB8',
  ink3: '#B49ED6',
  win: '#FFFDF9',         // window content (warm white)
  shadow: 'rgba(91,62,142,0.22)',
};

// Per-window pastel themes (title bar + accents)
const THEMES = {
  big3:   { bar: '#FFB3DE', accent: '#FF5FB0', soft: '#FFE6F4' },
  vault:  { bar: '#BFE7F2', accent: '#3FB8DE', soft: '#E3F6FB' },
  deleg:  { bar: '#DAC4FF', accent: '#9B5CFF', soft: '#F0E8FF' },
  decide: { bar: '#FCEE7A', accent: '#E8B400', soft: '#FFF8C9' },
  weekly: { bar: '#C8F0A6', accent: '#5FC92E', soft: '#EAFBDD' },
};

const PIXEL = "'Press Start 2P', monospace";
const TERM = "'VT323', monospace";

// Totally-Spies sparkle burst — fires when a task is completed.
const BURST_GLYPHS = ['✦', '♥', '★', '✿', '✦'];
const BURST_COLORS = ['#FF5FB0', '#FCD93D', '#9B5CFF', '#3FB8DE', '#FF8AD0'];
function SpyBurst() {
  const parts = useMemo(() => {
    const n = 9;
    return Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = 20 + Math.random() * 18;
      return {
        tx: Math.round(Math.cos(ang) * dist),
        ty: Math.round(Math.sin(ang) * dist),
        g: BURST_GLYPHS[i % BURST_GLYPHS.length],
        c: BURST_COLORS[i % BURST_COLORS.length],
        delay: Math.round(Math.random() * 70),
        size: 9 + Math.round(Math.random() * 6),
      };
    });
  }, []);
  return (
    <span style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 6 }} aria-hidden="true">
      {parts.map((p, i) => (
        <span key={i} className="spy-particle" style={{ '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, animationDelay: `${p.delay}ms`, color: p.c, fontSize: `${p.size}px` }}>{p.g}</span>
      ))}
    </span>
  );
}

const newId = (p = 'o') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
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

// Shared retro styles ---------------------------------------------------------
const inputStyle = {
  width: '100%', border: `2px solid ${C.edge}`, borderRadius: 4,
  padding: '7px 11px', fontFamily: TERM, fontSize: '1.15rem',
  color: C.ink, outline: 'none', background: '#fff',
  boxShadow: `inset 2px 2px 0 rgba(91,62,142,0.10)`,
};

const beveledBtn = (bg, enabled = true) => ({
  border: `2px solid ${C.edge}`, borderRadius: 5,
  background: enabled ? bg : '#E8E0F2', cursor: enabled ? 'pointer' : 'not-allowed',
  boxShadow: enabled ? `inset 1.5px 1.5px 0 rgba(255,255,255,0.65), 2px 2px 0 ${C.edge}` : 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: TERM, color: C.ink,
});

const chipStyle = (active, theme) => ({
  padding: '4px 12px', borderRadius: 4, fontSize: '1rem', fontFamily: TERM,
  letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer',
  border: `2px solid ${C.edge}`,
  background: active ? theme.accent : '#fff',
  color: active ? '#fff' : C.ink, whiteSpace: 'nowrap',
  boxShadow: active ? `inset 1px 1px 0 rgba(255,255,255,0.4)` : `1.5px 1.5px 0 ${C.edge}`,
});

// Window dots + buttons
function WinDots() {
  const dots = ['#FF6FB5', '#FCD93D', '#9B5CFF'];
  return (
    <span style={{ display: 'inline-flex', gap: 5, flexShrink: 0 }}>
      {dots.map((d, i) => (
        <span key={i} style={{ width: 11, height: 11, borderRadius: 999, background: d, border: `1.5px solid ${C.edge}` }} />
      ))}
    </span>
  );
}
function WinButtons({ open }) {
  const box = { width: 16, height: 14, borderRadius: 2, border: `1.5px solid ${C.edge}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TERM, fontSize: '0.7rem', color: C.ink, lineHeight: 1 };
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
      <span style={box}>_</span>
      <span style={box}>{open ? '–' : '□'}</span>
      <span style={box}>✕</span>
    </span>
  );
}

// Retro window shell ----------------------------------------------------------
function Win({ theme, icon, title, subtitle, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{
      border: `2px solid ${C.edge}`, borderRadius: 8, background: C.win,
      boxShadow: `4px 4px 0 ${C.shadow}`, overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', background: theme.bar, border: 'none',
        borderBottom: `2px solid ${C.edge}`, cursor: 'pointer', textAlign: 'left',
      }}>
        <WinDots />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ color: C.ink, display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
          <span style={{
            fontFamily: TERM, fontSize: '1.15rem', textTransform: 'uppercase',
            letterSpacing: '0.06em', color: C.ink, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</span>
        </span>
        <WinButtons open={open} />
      </button>
      {open && (
        <div style={{ padding: '12px 14px 16px' }}>
          {subtitle && (
            <p style={{ fontFamily: TERM, fontSize: '1.05rem', color: C.ink2, margin: '0 0 12px', lineHeight: 1.2 }}>{subtitle}</p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

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

  useEffect(() => { supabase.current = createClient(); loadAll(); }, [loadAll]);

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

  const addDecision = async ({ title, reasoning, expected }) => {
    const t = title.trim();
    if (!t) return;
    const row = { id: newId('dc'), user_id: userId, title: t, reasoning: reasoning.trim() || null, expected: expected.trim() || null, outcome: null, decided_at: new Date().toISOString(), reviewed_at: null };
    setDecisions(prev => [row, ...prev]);
    await sb().from('decisions').insert({ id: row.id, user_id: userId, title: t, reasoning: row.reasoning, expected: row.expected });
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

  const saveReview = async (fields) => {
    const next = { ...(review || {}), ...fields };
    setReview(next);
    const payload = {
      id: review?.id || newId('wr'), user_id: userId, week_start: weekStartKey,
      energized: next.energized || null, drained: next.drained || null,
      biggest_impact: next.biggest_impact || null, delegate_next: next.delegate_next || null,
      opportunities: next.opportunities || null,
    };
    await sb().from('weekly_reviews').upsert(payload, { onConflict: 'user_id,week_start' });
  };

  const fontStyle = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
      @keyframes spy-fly {
        0% { transform: translate(-50%,-50%) translate(0,0) scale(0.3) rotate(0deg); opacity: 0; }
        25% { opacity: 1; }
        100% { transform: translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(1.15) rotate(180deg); opacity: 0; }
      }
      .spy-particle { position: absolute; left: 0; top: 0; line-height: 1; transform: translate(-50%,-50%); opacity: 0; animation: spy-fly 0.72s ease-out forwards; }
      @keyframes spy-pop { 0% { transform: scale(1); } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
      .spy-check-pop { animation: spy-pop 0.42s cubic-bezier(.3,1.7,.5,1); }
      @keyframes spy-pulse {
        0% { box-shadow: 0 0 0 7px rgba(255,95,176,0); }
        50% { box-shadow: 0 0 0 7px rgba(255,95,176,0.38); }
        100% { box-shadow: 0 0 0 3px rgba(255,95,176,0.30); }
      }
      .spy-os input:focus, .spy-os textarea:focus {
        border-color: #FF5FB0 !important;
        box-shadow: 0 0 0 3px rgba(255,95,176,0.30) !important;
        animation: spy-pulse 0.5s ease;
        outline: none !important;
      }
      @keyframes spy-rowglow { 0% { background: rgba(255,95,176,0.28); } 100% { background: var(--rowbg, transparent); } }
    `}</style>
  );

  // Pink grid desktop background.
  const desktopBg = {
    padding: 16, borderRadius: 14,
    backgroundColor: '#FEF7FC',
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
    backgroundSize: '22px 22px',
    border: `2px solid ${C.edge}`,
    boxShadow: `4px 4px 0 ${C.shadow}`,
  };

  if (!loaded) {
    return (
      <div style={{ ...desktopBg, textAlign: 'center', padding: '60px 16px' }}>
        {fontStyle}
        <span style={{ fontFamily: TERM, fontSize: '1.4rem', color: C.ink }}>Loading your operating system…</span>
      </div>
    );
  }

  return (
    <div className="spy-os" style={{ ...desktopBg, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fontStyle}

      {/* Title window */}
      <div style={{ border: `2px solid ${C.edge}`, borderRadius: 8, background: '#fff', boxShadow: `4px 4px 0 ${C.shadow}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: '#DAC4FF', borderBottom: `2px solid ${C.edge}` }}>
          <WinDots />
          <span style={{ flex: 1, fontFamily: PIXEL, fontSize: '0.6rem', color: C.ink, letterSpacing: '0.02em' }}>ALIGN_OS.EXE</span>
          <WinButtons open />
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Star size={13} fill={C.accent || '#FCD93D'} color={C.edge} style={{ color: C.edge }} />
          {['Capture', 'Clarify', 'Delegate', 'Execute', 'Reflect'].map((step, i) => (
            <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: TERM, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.ink }}>{step}</span>
              {i < 4 && <span style={{ color: C.ink2, fontFamily: TERM, fontSize: '1.2rem' }}>▸</span>}
            </span>
          ))}
          <Heart size={13} fill="#FF6FB5" color={C.edge} />
        </div>
      </div>

      <BigThreeSection theme={THEMES.big3} lanes={LANES} bigThree={bigThree} onSet={setBigWin} onToggle={toggleBigWin} onRemove={removeBigWin} />
      <OpportunitySection theme={THEMES.vault} opps={opps} categories={CATEGORIES} onAdd={addOpp} onArchive={archiveOpp} onDelete={deleteOpp} />
      <DelegateSection theme={THEMES.deleg} delegates={delegates} decisions={DELEGATE_DECISIONS} onAdd={addDelegate} onDecide={setDelegateDecision} onComplete={completeDelegate} onDelete={deleteDelegate} />
      <DecisionSection theme={THEMES.decide} decisions={decisions} onAdd={addDecision} onReview={reviewDecision} onDelete={deleteDecision} />
      <WeeklyReviewSection theme={THEMES.weekly} review={review} weekStartKey={weekStartKey} onSave={saveReview} />
    </div>
  );
}

const emptyText = { fontFamily: TERM, fontSize: '1.2rem', color: C.ink2, padding: '4px 0' };

function BigThreeSection({ theme, lanes, bigThree, onSet, onToggle, onRemove }) {
  return (
    <Win theme={theme} icon={<Target size={15} />} title="The 3 Big Wins" subtitle="If you only did 3 things today, what moves your life forward?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {lanes.map(lane => {
          const win = bigThree.find(b => b.lane === lane.key);
          return <BigWinRow key={lane.key} theme={theme} lane={lane} win={win} onSet={onSet} onToggle={onToggle} onRemove={onRemove} />;
        })}
      </div>
    </Win>
  );
}

function BigWinRow({ theme, lane, win, onSet, onToggle, onRemove }) {
  const [draft, setDraft] = useState(win?.text || '');
  const [editing, setEditing] = useState(false);
  const [pop, setPop] = useState(false);
  useEffect(() => { setDraft(win?.text || ''); }, [win?.text]);
  const commit = () => { onSet(lane.key, draft); setEditing(false); };
  const handleToggle = () => {
    const willComplete = win && !win.completed;
    onToggle(win.id);
    if (willComplete) { setPop(true); setTimeout(() => setPop(false), 760); }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 5,
      border: `2px solid ${C.edge}`, background: win?.completed ? theme.soft : '#fff',
      boxShadow: `2px 2px 0 ${C.shadow}`,
    }}>
      <span style={{ fontFamily: TERM, fontSize: '0.92rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.accent, minWidth: 96, flexShrink: 0 }}>{lane.label}</span>
      {win && !editing ? (
        <>
          <button onClick={handleToggle} className={pop ? 'spy-check-pop' : ''} style={{
            position: 'relative', width: 22, height: 22, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
            border: `2px solid ${C.edge}`, background: win.completed ? theme.accent : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {win.completed && <Check size={14} color="#fff" strokeWidth={3} />}
            {pop && <SpyBurst key={Date.now()} />}
          </button>
          <span onClick={() => setEditing(true)} style={{ flex: 1, fontFamily: TERM, fontSize: '1.2rem', color: win.completed ? C.ink2 : C.ink, cursor: 'text', textDecoration: win.completed ? 'line-through' : 'none', lineHeight: 1.1 }}>{win.text}</span>
          <button onClick={() => onRemove(win.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink2, flexShrink: 0 }}><X size={16} /></button>
        </>
      ) : (
        <input value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder={`One ${lane.label.toLowerCase()} win…`} style={{ ...inputStyle, border: 'none', boxShadow: 'none', padding: '2px 0', flex: 1, background: 'transparent' }} autoFocus={editing} />
      )}
    </div>
  );
}

function OpportunitySection({ theme, opps, categories, onAdd, onArchive, onDelete }) {
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState('idea');
  const grouped = categories.map(c => ({ ...c, items: opps.filter(o => o.category === c.key) })).filter(g => g.items.length > 0);
  return (
    <Win theme={theme} icon={<Lightbulb size={15} />} title="Opportunity Vault" subtitle="Park ideas here. You're not allowed to act on them today.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onAdd(draft, cat); setDraft(''); } }} placeholder="Capture an idea…" style={inputStyle} />
        <button onClick={() => { onAdd(draft, cat); setDraft(''); }} disabled={!draft.trim()} style={{ ...beveledBtn(theme.accent, !!draft.trim()), padding: '0 14px', color: '#fff' }}><Plus size={18} /></button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {categories.map(c => <button key={c.key} onClick={() => setCat(c.key)} style={chipStyle(cat === c.key, theme)}>{c.label}</button>)}
      </div>
      {grouped.length === 0 ? <p style={emptyText}>No ideas parked yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(group => (
            <div key={group.key}>
              <p style={{ fontFamily: TERM, fontSize: '0.95rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.accent, margin: '0 0 6px' }}>{group.label} · {group.items.length}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map(o => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 11px', borderRadius: 5, background: theme.soft, border: `2px solid ${C.edge}` }}>
                    <span style={{ flex: 1, fontFamily: TERM, fontSize: '1.15rem', color: C.ink, lineHeight: 1.15 }}>{o.text}</span>
                    <button onClick={() => onArchive(o.id)} title="Archive" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink2, flexShrink: 0 }}><Archive size={15} /></button>
                    <button onClick={() => onDelete(o.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink2, flexShrink: 0 }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Win>
  );
}

function DelegateSection({ theme, delegates, decisions, onAdd, onDecide, onComplete, onDelete }) {
  const [draft, setDraft] = useState('');
  return (
    <Win theme={theme} icon={<ArrowRight size={15} />} title="Delegate List" subtitle="Does this need your genius? If not — delegate, automate, document, eliminate.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onAdd(draft); setDraft(''); } }} placeholder="Something you keep doing that you shouldn't…" style={inputStyle} />
        <button onClick={() => { onAdd(draft); setDraft(''); }} disabled={!draft.trim()} style={{ ...beveledBtn(theme.accent, !!draft.trim()), padding: '0 14px', color: '#fff' }}><Plus size={18} /></button>
      </div>
      {delegates.length === 0 ? <p style={emptyText}>Nothing to offload right now.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {delegates.map(d => (
            <div key={d.id} style={{ padding: '10px 12px', borderRadius: 5, border: `2px solid ${C.edge}`, background: '#fff', boxShadow: `2px 2px 0 ${C.shadow}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 9 }}>
                <span style={{ flex: 1, fontFamily: TERM, fontSize: '1.18rem', color: C.ink, lineHeight: 1.15 }}>{d.text}</span>
                <button onClick={() => onComplete(d.id)} title="Mark handled" style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0, cursor: 'pointer', border: `2px solid ${C.edge}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent }}><Check size={14} /></button>
                <button onClick={() => onDelete(d.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink2, flexShrink: 0 }}><Trash2 size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {decisions.map(dec => <button key={dec.key} onClick={() => onDecide(d.id, dec.key)} style={chipStyle(d.decision === dec.key, theme)}>{dec.label}</button>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Win>
  );
}

function DecisionSection({ theme, decisions, onAdd, onReview, onDelete }) {
  const [title, setTitle] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [expected, setExpected] = useState('');
  const [showForm, setShowForm] = useState(false);
  const submit = () => { onAdd({ title, reasoning, expected }); setTitle(''); setReasoning(''); setExpected(''); setShowForm(false); };
  return (
    <Win theme={theme} icon={<Scale size={15} />} title="Decision Journal" subtitle="Log the big calls and your reasoning. Review the outcome later." defaultOpen={false}>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{ ...beveledBtn('#fff'), padding: '8px 14px', gap: 6, fontSize: '1.1rem', marginBottom: 14 }}><Plus size={15} /> Log a decision</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, padding: 12, borderRadius: 6, background: theme.soft, border: `2px solid ${C.edge}` }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="The decision…" style={inputStyle} autoFocus />
          <textarea value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Why I'm making it…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <textarea value={expected} onChange={e => setExpected(e.target.value)} placeholder="What I expect to happen…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} disabled={!title.trim()} style={{ ...beveledBtn(theme.accent, !!title.trim()), padding: '8px 18px', color: '#fff', fontSize: '1.1rem' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ ...beveledBtn('#fff'), padding: '8px 18px', fontSize: '1.1rem' }}>Cancel</button>
          </div>
        </div>
      )}
      {decisions.length === 0 ? <p style={emptyText}>No decisions logged yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {decisions.map(d => <DecisionCard key={d.id} theme={theme} d={d} onReview={onReview} onDelete={onDelete} />)}
        </div>
      )}
    </Win>
  );
}

function DecisionCard({ theme, d, onReview, onDelete }) {
  const [outcomeDraft, setOutcomeDraft] = useState('');
  const [reviewing, setReviewing] = useState(false);
  return (
    <div style={{ padding: '11px 13px', borderRadius: 5, border: `2px solid ${C.edge}`, background: '#fff', boxShadow: `2px 2px 0 ${C.shadow}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontFamily: TERM, fontSize: '1.3rem', color: C.ink, lineHeight: 1.1 }}>{d.title}</span>
        <span style={{ fontFamily: TERM, fontSize: '0.95rem', color: C.ink2, flexShrink: 0, whiteSpace: 'nowrap' }}>{new Date(d.decided_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <button onClick={() => onDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.ink2, flexShrink: 0 }}><Trash2 size={15} /></button>
      </div>
      {d.reasoning && <p style={{ fontFamily: TERM, fontSize: '1.1rem', color: C.ink, marginTop: 5, lineHeight: 1.2 }}><b style={{ color: theme.accent }}>WHY: </b>{d.reasoning}</p>}
      {d.expected && <p style={{ fontFamily: TERM, fontSize: '1.1rem', color: C.ink, marginTop: 3, lineHeight: 1.2 }}><b style={{ color: theme.accent }}>EXPECTED: </b>{d.expected}</p>}
      {d.outcome ? (
        <p style={{ fontFamily: TERM, fontSize: '1.1rem', color: C.ink, marginTop: 7, lineHeight: 1.2, padding: '8px 10px', background: theme.soft, borderRadius: 5, border: `2px solid ${C.edge}` }}><b style={{ color: theme.accent }}>OUTCOME: </b>{d.outcome}</p>
      ) : reviewing ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={outcomeDraft} onChange={e => setOutcomeDraft(e.target.value)} placeholder="What actually happened…" style={inputStyle} onKeyDown={e => { if (e.key === 'Enter' && outcomeDraft.trim()) { onReview(d.id, outcomeDraft); setReviewing(false); } }} autoFocus />
          <button onClick={() => { if (outcomeDraft.trim()) { onReview(d.id, outcomeDraft); setReviewing(false); } }} style={{ ...beveledBtn(theme.accent), padding: '0 14px', color: '#fff' }}><Check size={16} /></button>
        </div>
      ) : (
        <button onClick={() => setReviewing(true)} style={{ marginTop: 8, fontFamily: TERM, fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add outcome</button>
      )}
    </div>
  );
}

function WeeklyReviewSection({ theme, review, weekStartKey, onSave }) {
  const QUESTIONS = [
    { key: 'energized', q: 'What energized me?' },
    { key: 'drained', q: 'What drained me?' },
    { key: 'biggest_impact', q: 'What created the biggest impact?' },
    { key: 'delegate_next', q: 'What should I delegate next week?' },
    { key: 'opportunities', q: 'What opportunities am I seeing?' },
  ];
  const weekLabel = new Date(weekStartKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return (
    <Win theme={theme} icon={<RefreshCw size={15} />} title="Weekly CEO Review" subtitle={`Your Friday meeting with yourself · week of ${weekLabel}`} defaultOpen={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {QUESTIONS.map(({ key, q }) => <ReviewQuestion key={key} theme={theme} q={q} value={review?.[key] || ''} onSave={(val) => onSave({ [key]: val })} />)}
      </div>
    </Win>
  );
}

function ReviewQuestion({ theme, q, value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: TERM, fontSize: '1.2rem', color: C.ink, marginBottom: 6, lineHeight: 1.1 }}>
        <Sparkles size={14} style={{ color: theme.accent }} /> {q}
      </label>
      <textarea value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onSave(draft); }} rows={2} placeholder="…" style={{ ...inputStyle, resize: 'vertical' }} />
    </div>
  );
}
