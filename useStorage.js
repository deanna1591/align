'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from './supabase-client';

const newId = (p = 't') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Convert flat task rows into { [date]: [task, ...] } shape used by the UI
function groupByDate(rows) {
  const out = {};
  for (const r of rows) {
    if (!out[r.date]) out[r.date] = [];
    out[r.date].push({
      id: r.id,
      text: r.text,
      completed: r.completed,
      started: r.started,
      startedAt: r.started_at,
      notes: r.notes || '',
      position: r.position,
    });
  }
  // sort by position within each day
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.position - b.position);
  return out;
}

export function useStorage() {
  const supabase = useRef(createClient()).current;

  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({});
  const [brainDump, setBrainDump] = useState([]);
  const [stats, setStats] = useState({ streak: 0, lastActiveDate: null });
  const [loaded, setLoaded] = useState(false);

  // -------- Auth: detect logged-in user on mount, subscribe to changes --------
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  // -------- Initial data load when user is known --------
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    let mounted = true;

    (async () => {
      const [tasksRes, brainRes, statsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('brain_dump').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('stats').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!mounted) return;
      setTasks(groupByDate(tasksRes.data || []));
      setBrainDump((brainRes.data || []).map(r => ({ id: r.id, text: r.text, createdAt: r.created_at })));
      setStats({
        streak: statsRes.data?.streak || 0,
        lastActiveDate: statsRes.data?.last_active_date || null,
      });
      setLoaded(true);
    })();

    return () => { mounted = false; };
  }, [user, supabase]);

  // -------- Real-time sync across devices --------
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`align-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id);
          setTasks(groupByDate(data || []));
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'brain_dump', filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase.from('brain_dump').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
          setBrainDump((data || []).map(r => ({ id: r.id, text: r.text, createdAt: r.created_at })));
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stats', filter: `user_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase.from('stats').select('*').eq('user_id', user.id).maybeSingle();
          if (data) setStats({ streak: data.streak, lastActiveDate: data.last_active_date });
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  // -------- Mutations --------
  const addTask = useCallback(async (dKey, text) => {
    if (!user) return;
    const existing = tasks[dKey] || [];
    const position = existing.length;
    const id = newId();
    // optimistic
    setTasks(prev => ({ ...prev, [dKey]: [...(prev[dKey] || []), { id, text, completed: false, started: false, notes: '', position }] }));
    await supabase.from('tasks').insert({ id, user_id: user.id, date: dKey, text, position });
  }, [user, tasks, supabase]);

  const toggleTask = useCallback(async (dKey, id) => {
    if (!user) return;
    const list = tasks[dKey] || [];
    const task = list.find(t => t.id === id);
    if (!task) return;
    const completing = !task.completed;
    // optimistic
    setTasks(prev => ({
      ...prev,
      [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, completed: completing, started: completing ? false : t.started } : t),
    }));
    await supabase.from('tasks').update({ completed: completing, started: completing ? false : task.started }).eq('id', id);

    // streak handling: completing on today
    if (completing && dKey === dateKey(today0())) {
      const todayK = dKey;
      if (stats.lastActiveDate !== todayK) {
        const y = new Date(today0()); y.setDate(y.getDate() - 1);
        const newStreak = stats.lastActiveDate === dateKey(y) ? stats.streak + 1 : 1;
        setStats({ streak: newStreak, lastActiveDate: todayK });
        await supabase.from('stats').upsert({ user_id: user.id, streak: newStreak, last_active_date: todayK });
      }
    }
  }, [user, tasks, stats, supabase]);

  const editTask = useCallback(async (dKey, id, text) => {
    if (!user) return;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, text } : t) }));
    await supabase.from('tasks').update({ text }).eq('id', id);
  }, [user, supabase]);

  const deleteTask = useCallback(async (dKey, id) => {
    if (!user) return;
    setTasks(prev => {
      const list = (prev[dKey] || []).filter(t => t.id !== id);
      const next = { ...prev, [dKey]: list };
      if (!list.length) delete next[dKey];
      return next;
    });
    await supabase.from('tasks').delete().eq('id', id);
  }, [user, supabase]);

  const startTask = useCallback(async (dKey, id) => {
    if (!user) return;
    const ts = new Date().toISOString();
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: true, startedAt: ts } : t) }));
    await supabase.from('tasks').update({ started: true, started_at: ts }).eq('id', id);
  }, [user, supabase]);

  const pauseTask = useCallback(async (dKey, id) => {
    if (!user) return;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: false } : t) }));
    await supabase.from('tasks').update({ started: false }).eq('id', id);
  }, [user, supabase]);

  const updateTaskNotes = useCallback(async (dKey, id, notes) => {
    if (!user) return;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, notes } : t) }));
    await supabase.from('tasks').update({ notes }).eq('id', id);
  }, [user, supabase]);

  const moveTaskBetweenDays = useCallback(async (fromDate, toDate, taskId) => {
    if (!user || fromDate === toDate) return;
    const fromList = tasks[fromDate] || [];
    const task = fromList.find(t => t.id === taskId);
    if (!task) return;
    const newPosition = (tasks[toDate] || []).length;
    // optimistic
    setTasks(prev => {
      const f = (prev[fromDate] || []).filter(t => t.id !== taskId);
      const next = { ...prev, [fromDate]: f, [toDate]: [...(prev[toDate] || []), { ...task, position: newPosition }] };
      if (!f.length) delete next[fromDate];
      return next;
    });
    await supabase.from('tasks').update({ date: toDate, position: newPosition }).eq('id', taskId);
  }, [user, tasks, supabase]);

  const addBrain = useCallback(async (text) => {
    if (!user) return;
    const id = newId('b');
    setBrainDump(prev => [{ id, text, createdAt: new Date().toISOString() }, ...prev]);
    await supabase.from('brain_dump').insert({ id, user_id: user.id, text });
  }, [user, supabase]);

  const deleteBrain = useCallback(async (id) => {
    if (!user) return;
    setBrainDump(prev => prev.filter(b => b.id !== id));
    await supabase.from('brain_dump').delete().eq('id', id);
  }, [user, supabase]);

  const promoteBrain = useCallback(async (id) => {
    if (!user) return;
    const item = brainDump.find(b => b.id === id);
    if (!item) return;
    await addTask(dateKey(today0()), item.text);
    await deleteBrain(id);
  }, [user, brainDump, addTask, deleteBrain]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTasks({});
    setBrainDump([]);
    setStats({ streak: 0, lastActiveDate: null });
  }, [supabase]);

  return {
    user, tasks, brainDump, stats, loaded,
    addTask, toggleTask, editTask, deleteTask,
    startTask, pauseTask, updateTaskNotes, moveTaskBetweenDays,
    addBrain, deleteBrain, promoteBrain,
    signOut,
  };
}
