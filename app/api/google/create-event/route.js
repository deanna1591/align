// POST /api/google/create-event
// Creates an event on the user's chosen Google Calendar.
// Called from Quick Capture after Claude parses the input as an event.
//
// Body: { title, date "YYYY-MM-DD", time "HH:MM" or null, duration_minutes, all_day, user_timezone, google_email?, align_task_id? }
// Returns: { event_id, html_link, calendar_id, google_email, label }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { refreshAccessToken, hasWriteScope } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

async function getValidAccessToken(connection, supabase) {
  const expiresAt = new Date(connection.expires_at);
  const bufferMs = 60 * 1000;
  if (expiresAt.getTime() - Date.now() > bufferMs) {
    return connection.access_token;
  }
  const refreshed = await refreshAccessToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from('google_calendar_connections')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', connection.user_id)
    .eq('google_email', connection.google_email);
  return refreshed.access_token;
}

// Compute end date + time for a timed event by adding `mins` to start.
// Handles overflow past midnight (a 90-minute event starting at 23:00 → next day 00:30).
function computeEnd(date, time, mins) {
  const [h, m] = time.split(':').map(Number);
  const startMins = h * 60 + m;
  const totalMins = startMins + mins;
  const dayOffset = Math.floor(totalMins / 1440); // 1440 = mins/day
  const endH = Math.floor((totalMins % 1440) / 60);
  const endM = totalMins % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  if (dayOffset === 0) return { date, time: endTime };
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return { date: d.toISOString().slice(0, 10), time: endTime };
}

// All-day events use exclusive end date — i.e. an event "on June 9" is start=06-09, end=06-10.
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    title, date, time, duration_minutes, all_day,
    user_timezone, google_email, align_task_id,
  } = body;

  if (!title || !date) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Pick which Google connection to write to.
  // If the caller specifies google_email, use that one.
  // Otherwise: oldest connection that has write scope (deterministic default).
  const { data: connections, error: connErr } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');
  if (connErr) {
    return NextResponse.json({ error: connErr.message }, { status: 500 });
  }
  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'no_connections' }, { status: 400 });
  }

  let connection;
  if (google_email) {
    connection = connections.find((c) => c.google_email === google_email && hasWriteScope(c));
  } else {
    connection = connections.find((c) => hasWriteScope(c));
  }
  if (!connection) {
    return NextResponse.json({ error: 'no_write_capable_connection' }, { status: 400 });
  }

  const tz = user_timezone || 'UTC';
  const calendarId = connection.write_calendar_id || 'primary';

  // Build the event payload per Google's format.
  let eventBody;
  if (all_day || !time) {
    eventBody = {
      summary: title,
      start: { date },
      end: { date: addDays(date, 1) },
    };
  } else {
    const dur = Number.isFinite(duration_minutes) && duration_minutes > 0 ? duration_minutes : 60;
    const end = computeEnd(date, time, dur);
    eventBody = {
      summary: title,
      start: { dateTime: `${date}T${time}:00`, timeZone: tz },
      end: { dateTime: `${end.date}T${end.time}:00`, timeZone: tz },
    };
  }

  try {
    const token = await getValidAccessToken(connection, supabase);
    const insertRes = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('[Align] Event insert failed:', insertRes.status, errText.slice(0, 500));
      return NextResponse.json(
        { error: 'create_failed', status: insertRes.status, detail: errText.slice(0, 500) },
        { status: 502 }
      );
    }

    const googleEvent = await insertRes.json();

    // If the caller passed an align_task_id, link it so we can update/delete
    // the Google event when the Align task changes. Skipped silently if not
    // provided — the event still gets created.
    if (align_task_id) {
      const { error: linkErr } = await supabase.from('align_events').insert({
        user_id: user.id,
        align_task_id,
        google_event_id: googleEvent.id,
        google_calendar_id: calendarId,
      });
      if (linkErr) {
        console.error('[Align] align_events insert failed:', linkErr.message);
        // non-fatal — return success since the Google event was created
      }
    }

    return NextResponse.json({
      event_id: googleEvent.id,
      html_link: googleEvent.htmlLink,
      calendar_id: calendarId,
      google_email: connection.google_email,
      label: connection.label,
    });
  } catch (err) {
    console.error('[Align] create-event error:', err);
    return NextResponse.json({ error: err.message || 'unknown' }, { status: 500 });
  }
}
