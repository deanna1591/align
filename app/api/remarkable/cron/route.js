// app/api/remarkable/cron/route.js
//
// Runs on a schedule (see vercel.json) — no browser, no user session — so it
// reads your data directly with a Supabase service-role key and pushes the
// daily agenda to your reMarkable.
//
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { remarkable } from 'rmapi-js';
import { buildAgendaPdf } from '@/lib/remarkable-agenda';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Today's date key + a friendly label, computed in YOUR timezone (cron fires
// in UTC, so without this a 6am push could land on the wrong calendar day).
function todayInTz(tz) {
  const now = new Date();
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now); // YYYY-MM-DD
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric',
  }).format(now);
  return { key, label };
}

import { fetchEventsForUser } from '@/lib/google-calendar';

// "GMT-07:00" style offset for a timezone on a given date → "-07:00"
function tzOffset(tz, dateKey) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${dateKey}T12:00:00Z`));
    const name = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-07:00';
    const m = name.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : '-07:00';
  } catch { return '-07:00'; }
}

// Calendar events for the user's day, using the same token-refreshing
// fetch the app itself uses.
async function getTodayEvents(supa, userId, tz, todayKey) {
  const off = tzOffset(tz, todayKey);
  const dayStart = new Date(`${todayKey}T00:00:00${off}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  try {
    const { events = [] } = await fetchEventsForUser(supa, userId, dayStart, dayEnd);
    const todays = events.filter(ev => {
      if (ev.allDay) return String(ev.start).slice(0, 10) === todayKey;
      const s = new Date(ev.start);
      return s >= dayStart && s < dayEnd;
    });
    todays.sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.start) - new Date(b.start);
    });
    return todays.map(ev => ({
      time: ev.allDay
        ? 'all day'
        : new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).toLowerCase().replace(' ', ''),
      title: ev.title || '',
    }));
  } catch (e) {
    console.error('[reMarkable cron] events fetch failed:', e);
    return []; // calendar failure shouldn't block the agenda
  }
}

export async function GET(req) {
  // Vercel attaches `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deviceToken = (process.env.REMARKABLE_TOKEN || "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.ALIGN_USER_ID;
  const tz = process.env.ALIGN_TZ || 'America/Phoenix';
  if (!deviceToken || !url || !serviceKey || !userId) {
    return NextResponse.json(
      { error: 'Missing env (need REMARKABLE_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALIGN_USER_ID)' },
      { status: 503 },
    );
  }

  const { key: todayKey, label: dateLabel } = todayInTz(tz);

  try {
    const supa = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Today's tasks + still-open tasks from earlier days (the "leftover" set).
    const { data: rows, error } = await supa
      .from('tasks')
      .select('text, completed, date')
      .eq('user_id', userId);
    if (error) throw error;

    const relevant = (rows || []).filter(r =>
      r.date === todayKey || (r.date && r.date < todayKey && !r.completed),
    );
    relevant.sort((a, b) => {
      const al = a.date < todayKey ? 0 : 1;
      const bl = b.date < todayKey ? 0 : 1;
      if (al !== bl) return al - bl;            // leftover first
      return (a.completed ? 1 : 0) - (b.completed ? 1 : 0); // open before done
    });
    const tasks = relevant.map(r => ({
      text: r.text,
      completed: !!r.completed,
      leftover: !!r.date && r.date < todayKey,
    }));

    // Big Three (the OS priority layer) for today.
    const LANES = [
      { key: 'personal', label: 'Personal' },
      { key: 'work', label: 'RemoteGenies' },
      { key: 'team', label: 'Leadership / Team' },
    ];
    const { data: b3rows } = await supa
      .from('big_three')
      .select('lane, text, completed')
      .eq('user_id', userId)
      .eq('date', todayKey);
    const byLane = {};
    for (const r of (b3rows || [])) byLane[r.lane] = r;
    const bigThree = LANES.map(l => ({
      label: l.label,
      text: byLane[l.key]?.text || '',
      completed: !!byLane[l.key]?.completed,
    }));

    const events = await getTodayEvents(supa, userId, tz, todayKey);

    const bytes = await buildAgendaPdf({ dateLabel, bigThree, tasks, events });
    const api = await remarkable(deviceToken);
    const entry = await api.uploadPdf(`align \u00B7 ${dateLabel}`, bytes);

    return NextResponse.json({ ok: true, id: entry?.id ?? null, bigThree: bigThree.filter(b => b.text).length, tasks: tasks.length, events: events.length });
  } catch (e) {
    console.error('[reMarkable cron]', e);
    return NextResponse.json({ error: e?.message || 'Cron push failed' }, { status: 502 });
  }
}
