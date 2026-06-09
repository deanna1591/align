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

// Calendar events for the day. Filled in once we share the Google fetch logic
// with app/api/google/events — returns [] until then (tasks-only agenda).
async function getTodayEvents(/* userId, tz */) {
  return [];
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

    const events = await getTodayEvents(userId, tz);

    const bytes = await buildAgendaPdf({ dateLabel, bigThree, tasks, events });
    const api = await remarkable(deviceToken);
    const entry = await api.uploadPdf(`align \u00B7 ${dateLabel}`, bytes);

    return NextResponse.json({ ok: true, id: entry?.id ?? null, bigThree: bigThree.filter(b => b.text).length, tasks: tasks.length, events: events.length });
  } catch (e) {
    console.error('[reMarkable cron]', e);
    return NextResponse.json({ error: e?.message || 'Cron push failed' }, { status: 502 });
  }
}
