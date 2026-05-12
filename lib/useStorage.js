'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from './supabase-client';

const newId = (p = 't') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function rowToTask(r) {
  return {
    id: r.id,
    text: r.text,
    completed: r.completed,
    started: r.started,
    startedAt: r.started_at,
    notes: r.notes || '',
    position: r.position,
  };
}

function groupByDate(rows) {
  const out = {};
  for (const r of rows) {
    if (!out[r.date]) out[r.date] = [];
    out[r.date].push(rowToTask(r));
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.position - b.position);
  return out;
}

// Show a temporary error banner instead of alert() so the UI doesn't freeze
function reportError(setError, label, err) {
  console.error(`[Align] ${label}:`, err);
  setError({ label, message: err?.message || String(err) });
  setTimeout(() => setError(null), 6000);
}

export function useStorage() {
  const supabase = useRef(createClient()).current;

  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({});
  const [brainDump, setBrainDump] = useState([]);
  const [stats, setStats] = useState({ streak: 0, lastActiveDate: null });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // ---- Auth ----
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error: e }) => {
      if (e) console.error('[Align] getUser:', e);
      if (mounted) setUser(data?.user || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  // ---- Initial load ----
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    let mounted = true;
    (async () => {
      try {
        const [tasksRes, brainRes, statsRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', user.id),
          supabase.from('brain_dump').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('stats').select('*').eq('user_id', user.id).maybeSingle(),
        ]);
        if (tasksRes.error) reportError(setError, 'Load tasks', tasksRes.error);
        if (brainRes.error) reportError(setError, 'Load brain dump', brainRes.error);
        if (statsRes.error) reportError(setError, 'Load stats', statsRes.error);
        if (!mounted) return;
        setTasks(groupByDate(tasksRes.data || []));
        setBrainDump((brainRes.data || []).map(r => ({ id: r.id, text: r.text, createdAt: r.created_at })));
        setStats({
          streak: statsRes.data?.streak || 0,
          lastActiveDate: statsRes.data?.last_active_date || null,
        });
        setLoaded(true);
      } catch (e) {
        reportError(setError, 'Initial load', e);
        setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, [user, supabase]);

  // ---- Real-time: apply change payloads directly (no refetch) ----
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`align-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const t = rowToTask(payload.new);
          const date = payload.new.date;
          setTasks(prev => {
            const list = prev[date] || [];
            if (list.some(x => x.id === t.id)) return prev;
            return { ...prev, [date]: [...list, t].sort((a, b) => a.position - b.position) };
          });
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const t = rowToTask(payload.new);
          const newDate = payload.new.date;
          const oldDate = payload.old?.date;
          setTasks(prev => {
            const next = { ...prev };
            if (oldDate && oldDate !== newDate && next[oldDate]) {
              next[oldDate] = next[oldDate].filter(x => x.id !== t.id);
              if (!next[oldDate].length) delete next[oldDate];
            }
            const list = next[newDate] || [];
            const idx = list.findIndex(x => x.id === t.id);
            const updated = idx >= 0 ? list.map((x, i) => i === idx ? t : x) : [...list, t];
            next[newDate] = updated.sort((a, b) => a.position - b.position);
            return next;
          });
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const id = payload.old?.id;
          if (!id) return;
          setTasks(prev => {
            const next = { ...prev };
            for (const d of Object.keys(next)) {
              next[d] = next[d].filter(x => x.id !== id);
              if (!next[d].length) delete next[d];
            }
            return next;
          });
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'brain_dump', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setBrainDump(prev => {
            if (prev.some(b => b.id === payload.new.id)) return prev;
            return [{ id: payload.new.id, text: payload.new.text, createdAt: payload.new.created_at }, ...prev];
          });
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'brain_dump', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const id = payload.old?.id;
          if (!id) return;
          setBrainDump(prev => prev.filter(b => b.id !== id));
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stats', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (!payload.new) return;
          setStats({ streak: payload.new.streak, lastActiveDate: payload.new.last_active_date });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, supabase]);

  // ---- Mutations: optimistic, with revert on failure ----

  const addTask = useCallback(async (dKey, text) => {
    if (!user) { reportError(setError, 'Add task', new Error('Not signed in')); return; }
    const existing = tasks[dKey] || [];
    const position = existing.length;
    const id = newId();
    const newTask = { id, text, completed: false, started: false, notes: '', position };
    setTasks(prev => ({ ...prev, [dKey]: [...(prev[dKey] || []), newTask] }));
    const { error: e } = await supabase.from('tasks').insert({ id, user_id: user.id, date: dKey, text, position });
    if (e) {
      reportError(setError, 'Save task', e);
      setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).filter(t => t.id !== id) }));
    }
  }, [user, tasks, supabase]);

  const toggleTask = useCallback(async (dKey, id) => {
    if (!user) return;
    const list = tasks[dKey] || [];
    const task = list.find(t => t.id === id);
    if (!task) return;
    const completing = !task.completed;
    setTasks(prev => ({
      ...prev,
      [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, completed: completing, started: completing ? false : t.started } : t),
    }));
    const { error: e } = await supabase.from('tasks').update({ completed: completing, started: completing ? false : task.started }).eq('id', id);
    if (e) {
      reportError(setError, 'Update task', e);
      setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? task : t) }));
      return;
    }

    if (completing && dKey === dateKey(today0())) {
      if (stats.lastActiveDate !== dKey) {
        const y = new Date(today0()); y.setDate(y.getDate() - 1);
        const newStreak = stats.lastActiveDate === dateKey(y) ? stats.streak + 1 : 1;
        setStats({ streak: newStreak, lastActiveDate: dKey });
        const { error: se } = await supabase.from('stats').upsert({ user_id: user.id, streak: newStreak, last_active_date: dKey });
        if (se) reportError(setError, 'Update streak', se);
      }
    }
  }, [user, tasks, stats, supabase]);

  const editTask = useCallback(async (dKey, id, text) => {
    if (!user) return;
    const prevText = (tasks[dKey] || []).find(t => t.id === id)?.text;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, text } : t) }));
    const { error: e } = await supabase.from('tasks').update({ text }).eq('id', id);
    if (e) {
      reportError(setError, 'Edit task', e);
      if (prevText !== undefined) {
        setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, text: prevText } : t) }));
      }
    }
  }, [user, tasks, supabase]);

  const deleteTask = useCallback(async (dKey, id) => {
    if (!user) return;
    const previous = tasks[dKey] || [];
    setTasks(prev => {
      const list = (prev[dKey] || []).filter(t => t.id !== id);
      const next = { ...prev, [dKey]: list };
      if (!list.length) delete next[dKey];
      return next;
    });
    const { error: e } = await supabase.from('tasks').delete().eq('id', id);
    if (e) {
      reportError(setError, 'Delete task', e);
      setTasks(prev => ({ ...prev, [dKey]: previous }));
    }
  }, [user, tasks, supabase]);

  const startTask = useCallback(async (dKey, id) => {
    if (!user) return;
    const ts = new Date().toISOString();
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: true, startedAt: ts } : t) }));
    const { error: e } = await supabase.from('tasks').update({ started: true, started_at: ts }).eq('id', id);
    if (e) {
      reportError(setError, 'Start task', e);
      setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: false } : t) }));
    }
  }, [user, supabase]);

  const pauseTask = useCallback(async (dKey, id) => {
    if (!user) return;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: false } : t) }));
    const { error: e } = await supabase.from('tasks').update({ started: false }).eq('id', id);
    if (e) {
      reportError(setError, 'Pause task', e);
      setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: true } : t) }));
    }
  }, [user, supabase]);

  const updateTaskNotes = useCallback(async (dKey, id, notes) => {
    if (!user) return;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, notes } : t) }));
    const { error: e } = await supabase.from('tasks').update({ notes }).eq('id', id);
    if (e) reportError(setError, 'Save notes', e);
  }, [user, supabase]);

  const moveTaskBetweenDays = useCallback(async (fromDate, toDate, taskId) => {
    if (!user || fromDate === toDate) return;
    const fromList = tasks[fromDate] || [];
    const task = fromList.find(t => t.id === taskId);
    if (!task) return;
    const newPosition = (tasks[toDate] || []).length;
    const original = tasks;
    setTasks(prev => {
      const f = (prev[fromDate] || []).filter(t => t.id !== taskId);
      const next = { ...prev, [fromDate]: f, [toDate]: [...(prev[toDate] || []), { ...task, position: newPosition }] };
      if (!f.length) delete next[fromDate];
      return next;
    });
    const { error: e } = await supabase.from('tasks').update({ date: toDate, position: newPosition }).eq('id', taskId);
    if (e) {
      reportError(setError, 'Move task', e);
      setTasks(original);
    }
  }, [user, tasks, supabase]);

  const addBrain = useCallback(async (text) => {
    if (!user) { reportError(setError, 'Add brain dump', new Error('Not signed in')); return; }
    const id = newId('b');
    const createdAt = new Date().toISOString();
    setBrainDump(prev => [{ id, text, createdAt }, ...prev]);
    const { error: e } = await supabase.from('brain_dump').insert({ id, user_id: user.id, text });
    if (e) {
      reportError(setError, 'Save brain dump', e);
      setBrainDump(prev => prev.filter(b => b.id !== id));
    }
  }, [user, supabase]);

  const deleteBrain = useCallback(async (id) => {
    if (!user) return;
    const previous = brainDump;
    setBrainDump(prev => prev.filter(b => b.id !== id));
    const { error: e } = await supabase.from('brain_dump').delete().eq('id', id);
    if (e) {
      reportError(setError, 'Delete brain dump', e);
      setBrainDump(previous);
    }
  }, [user, brainDump, supabase]);

  const promoteBrain = useCallback(async (id) => {
    if (!user) return;
    const item = brainDump.find(b => b.id === id);
    if (!item) return;
    await addTask(dateKey(today0()), item.text);
    await deleteBrain(id);
  }, [user, brainDump, addTask, deleteBrain]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, [supabase]);

  return {
    user, tasks, brainDump, stats, loaded, error,
    addTask, toggleTask, editTask, deleteTask,
    startTask, pauseTask, updateTaskNotes, moveTaskBetweenDays,
    addBrain, deleteBrain, promoteBrain,
    signOut,
  };
}
