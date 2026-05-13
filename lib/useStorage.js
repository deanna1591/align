'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from './supabase-client';

const newId = (p = 't') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function rowToTask(r) {
  return {
    id: r.id, text: r.text, completed: r.completed, started: r.started,
    startedAt: r.started_at, notes: r.notes || '', position: r.position,
  };
}
function rowToListItem(r) {
  return { id: r.id, text: r.text, completed: r.completed, position: r.position };
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
function groupItemsByList(rows) {
  const out = {};
  for (const r of rows) {
    if (!out[r.list_id]) out[r.list_id] = [];
    out[r.list_id].push(rowToListItem(r));
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.position - b.position);
  return out;
}

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
  const [lists, setLists] = useState([]);
  const [listItems, setListItems] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    let mounted = true;
    (async () => {
      try {
        const [tasksRes, brainRes, statsRes, listsRes, itemsRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', user.id),
          supabase.from('brain_dump').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('stats').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('lists').select('*').eq('user_id', user.id).order('position', { ascending: true }),
          supabase.from('list_items').select('*').eq('user_id', user.id),
        ]);
        if (tasksRes.error) reportError(setError, 'Load tasks', tasksRes.error);
        if (brainRes.error) reportError(setError, 'Load brain dump', brainRes.error);
        if (statsRes.error) reportError(setError, 'Load stats', statsRes.error);
        if (listsRes.error) reportError(setError, 'Load lists', listsRes.error);
        if (itemsRes.error) reportError(setError, 'Load list items', itemsRes.error);
        if (!mounted) return;
        setTasks(groupByDate(tasksRes.data || []));
        setBrainDump((brainRes.data || []).map(r => ({ id: r.id, text: r.text, createdAt: r.created_at })));
        setStats({ streak: statsRes.data?.streak || 0, lastActiveDate: statsRes.data?.last_active_date || null });
        setLists((listsRes.data || []).map(r => ({ id: r.id, title: r.title, position: r.position })));
        setListItems(groupItemsByList(itemsRes.data || []));
        setLoaded(true);
      } catch (e) {
        reportError(setError, 'Initial load', e);
        setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`align-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const t = rowToTask(payload.new); const date = payload.new.date;
          setTasks(prev => {
            const list = prev[date] || [];
            if (list.some(x => x.id === t.id)) return prev;
            return { ...prev, [date]: [...list, t].sort((a, b) => a.position - b.position) };
          });
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const t = rowToTask(payload.new); const newDate = payload.new.date; const oldDate = payload.old?.date;
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const id = payload.old?.id; if (!id) return;
          setTasks(prev => {
            const next = { ...prev };
            for (const d of Object.keys(next)) {
              next[d] = next[d].filter(x => x.id !== id);
              if (!next[d].length) delete next[d];
            }
            return next;
          });
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'brain_dump', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setBrainDump(prev => prev.some(b => b.id === payload.new.id) ? prev : [{ id: payload.new.id, text: payload.new.text, createdAt: payload.new.created_at }, ...prev]);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'brain_dump', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const id = payload.old?.id; if (!id) return;
          setBrainDump(prev => prev.filter(b => b.id !== id));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stats', filter: `user_id=eq.${user.id}` },
        (payload) => { if (!payload.new) return; setStats({ streak: payload.new.streak, lastActiveDate: payload.new.last_active_date }); })
      // Lists realtime
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lists', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const l = { id: payload.new.id, title: payload.new.title, position: payload.new.position };
          setLists(prev => prev.some(x => x.id === l.id) ? prev : [...prev, l].sort((a, b) => a.position - b.position));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lists', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const id = payload.old?.id; if (!id) return;
          setLists(prev => prev.filter(l => l.id !== id));
          setListItems(prev => { const next = { ...prev }; delete next[id]; return next; });
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lists', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setLists(prev => prev.map(l => l.id === payload.new.id ? { id: payload.new.id, title: payload.new.title, position: payload.new.position } : l));
        })
      // List items realtime
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'list_items', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const item = rowToListItem(payload.new); const lid = payload.new.list_id;
          setListItems(prev => {
            const list = prev[lid] || [];
            if (list.some(x => x.id === item.id)) return prev;
            return { ...prev, [lid]: [...list, item].sort((a, b) => a.position - b.position) };
          });
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'list_items', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const item = rowToListItem(payload.new); const lid = payload.new.list_id;
          setListItems(prev => ({
            ...prev,
            [lid]: (prev[lid] || []).map(x => x.id === item.id ? item : x).sort((a, b) => a.position - b.position),
          }));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'list_items', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const id = payload.old?.id; if (!id) return;
          setListItems(prev => {
            const next = { ...prev };
            for (const lid of Object.keys(next)) {
              next[lid] = next[lid].filter(x => x.id !== id);
            }
            return next;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, supabase]);

  // --- Task mutations (unchanged) ---
  const addTask = useCallback(async (dKey, text) => {
    if (!user) { reportError(setError, 'Add task', new Error('Not signed in')); return; }
    const position = (tasks[dKey] || []).length;
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
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, completed: completing, started: completing ? false : t.started } : t) }));
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
      if (prevText !== undefined) setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, text: prevText } : t) }));
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
    if (e) { reportError(setError, 'Delete task', e); setTasks(prev => ({ ...prev, [dKey]: previous })); }
  }, [user, tasks, supabase]);

  const startTask = useCallback(async (dKey, id) => {
    if (!user) return;
    const ts = new Date().toISOString();
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: true, startedAt: ts } : t) }));
    const { error: e } = await supabase.from('tasks').update({ started: true, started_at: ts }).eq('id', id);
    if (e) { reportError(setError, 'Start task', e); setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: false } : t) })); }
  }, [user, supabase]);

  const pauseTask = useCallback(async (dKey, id) => {
    if (!user) return;
    setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: false } : t) }));
    const { error: e } = await supabase.from('tasks').update({ started: false }).eq('id', id);
    if (e) { reportError(setError, 'Pause task', e); setTasks(prev => ({ ...prev, [dKey]: (prev[dKey] || []).map(t => t.id === id ? { ...t, started: true } : t) })); }
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
    if (e) { reportError(setError, 'Move task', e); setTasks(original); }
  }, [user, tasks, supabase]);

  // Convert a task into a list item — task disappears from day column, becomes a new item in the chosen list
  const moveTaskToList = useCallback(async (fromDate, taskId, listId) => {
    if (!user) return;
    const fromList = tasks[fromDate] || [];
    const task = fromList.find(t => t.id === taskId);
    if (!task) return;
    const newItemId = newId('li');
    const newItemPosition = (listItems[listId] || []).length;
    const newItem = { id: newItemId, text: task.text, completed: false, position: newItemPosition };

    // Optimistic: remove task, add item
    const originalTasks = tasks;
    const originalItems = listItems;
    setTasks(prev => {
      const f = (prev[fromDate] || []).filter(t => t.id !== taskId);
      const next = { ...prev, [fromDate]: f };
      if (!f.length) delete next[fromDate];
      return next;
    });
    setListItems(prev => ({ ...prev, [listId]: [...(prev[listId] || []), newItem] }));

    // Insert list item first, then delete the task
    const { error: insertErr } = await supabase.from('list_items').insert({
      id: newItemId, list_id: listId, user_id: user.id, text: task.text, position: newItemPosition,
    });
    if (insertErr) {
      reportError(setError, 'Move to list', insertErr);
      setTasks(originalTasks);
      setListItems(originalItems);
      return;
    }
    const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId);
    if (delErr) {
      reportError(setError, 'Move to list (cleanup)', delErr);
      // Don't revert — list item is created; just leave the orphan task and let realtime sync handle it
    }
  }, [user, tasks, listItems, supabase]);

  // --- Brain dump (unchanged) ---
  const addBrain = useCallback(async (text) => {
    if (!user) { reportError(setError, 'Add brain dump', new Error('Not signed in')); return; }
    const id = newId('b');
    const createdAt = new Date().toISOString();
    setBrainDump(prev => [{ id, text, createdAt }, ...prev]);
    const { error: e } = await supabase.from('brain_dump').insert({ id, user_id: user.id, text });
    if (e) { reportError(setError, 'Save brain dump', e); setBrainDump(prev => prev.filter(b => b.id !== id)); }
  }, [user, supabase]);

  const deleteBrain = useCallback(async (id) => {
    if (!user) return;
    const previous = brainDump;
    setBrainDump(prev => prev.filter(b => b.id !== id));
    const { error: e } = await supabase.from('brain_dump').delete().eq('id', id);
    if (e) { reportError(setError, 'Delete brain dump', e); setBrainDump(previous); }
  }, [user, brainDump, supabase]);

  const promoteBrain = useCallback(async (id) => {
    if (!user) return;
    const item = brainDump.find(b => b.id === id);
    if (!item) return;
    await addTask(dateKey(today0()), item.text);
    await deleteBrain(id);
  }, [user, brainDump, addTask, deleteBrain]);

  // --- Lists ---
  const createList = useCallback(async (title) => {
    if (!user) return;
    const id = newId('l');
    const position = lists.length;
    const newList = { id, title, position };
    setLists(prev => [...prev, newList]);
    const { error: e } = await supabase.from('lists').insert({ id, user_id: user.id, title, position });
    if (e) { reportError(setError, 'Create list', e); setLists(prev => prev.filter(l => l.id !== id)); }
  }, [user, lists, supabase]);

  const deleteList = useCallback(async (id) => {
    if (!user) return;
    const previous = lists;
    const prevItems = listItems[id] || [];
    setLists(prev => prev.filter(l => l.id !== id));
    setListItems(prev => { const next = { ...prev }; delete next[id]; return next; });
    const { error: e } = await supabase.from('lists').delete().eq('id', id);
    if (e) {
      reportError(setError, 'Delete list', e);
      setLists(previous);
      setListItems(prev => ({ ...prev, [id]: prevItems }));
    }
  }, [user, lists, listItems, supabase]);

  const addListItem = useCallback(async (listId, text) => {
    if (!user) return;
    const id = newId('li');
    const position = (listItems[listId] || []).length;
    const newItem = { id, text, completed: false, position };
    setListItems(prev => ({ ...prev, [listId]: [...(prev[listId] || []), newItem] }));
    const { error: e } = await supabase.from('list_items').insert({ id, list_id: listId, user_id: user.id, text, position });
    if (e) {
      reportError(setError, 'Add list item', e);
      setListItems(prev => ({ ...prev, [listId]: (prev[listId] || []).filter(i => i.id !== id) }));
    }
  }, [user, listItems, supabase]);

  const toggleListItem = useCallback(async (listId, itemId) => {
    if (!user) return;
    const item = (listItems[listId] || []).find(i => i.id === itemId);
    if (!item) return;
    const completing = !item.completed;
    setListItems(prev => ({ ...prev, [listId]: (prev[listId] || []).map(i => i.id === itemId ? { ...i, completed: completing } : i) }));
    const { error: e } = await supabase.from('list_items').update({ completed: completing }).eq('id', itemId);
    if (e) {
      reportError(setError, 'Toggle list item', e);
      setListItems(prev => ({ ...prev, [listId]: (prev[listId] || []).map(i => i.id === itemId ? item : i) }));
    }
  }, [user, listItems, supabase]);

  const editListItem = useCallback(async (listId, itemId, text) => {
    if (!user) return;
    const prevItem = (listItems[listId] || []).find(i => i.id === itemId);
    setListItems(prev => ({ ...prev, [listId]: (prev[listId] || []).map(i => i.id === itemId ? { ...i, text } : i) }));
    const { error: e } = await supabase.from('list_items').update({ text }).eq('id', itemId);
    if (e) {
      reportError(setError, 'Edit list item', e);
      if (prevItem) setListItems(prev => ({ ...prev, [listId]: (prev[listId] || []).map(i => i.id === itemId ? prevItem : i) }));
    }
  }, [user, listItems, supabase]);

  const deleteListItem = useCallback(async (listId, itemId) => {
    if (!user) return;
    const previous = listItems[listId] || [];
    setListItems(prev => ({ ...prev, [listId]: (prev[listId] || []).filter(i => i.id !== itemId) }));
    const { error: e } = await supabase.from('list_items').delete().eq('id', itemId);
    if (e) { reportError(setError, 'Delete list item', e); setListItems(prev => ({ ...prev, [listId]: previous })); }
  }, [user, listItems, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, [supabase]);

  return {
    user, tasks, brainDump, stats, lists, listItems, loaded, error,
    addTask, toggleTask, editTask, deleteTask,
    startTask, pauseTask, updateTaskNotes, moveTaskBetweenDays, moveTaskToList,
    addBrain, deleteBrain, promoteBrain,
    createList, deleteList, addListItem, toggleListItem, editListItem, deleteListItem,
    signOut,
  };
}
