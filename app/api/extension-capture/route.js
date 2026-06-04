// POST /api/extension-capture
// Authenticated via Bearer token (same as /api/voice-capture). Used by the
// Align Chrome extension, which can't read Supabase session cookies.
//
// Flow:
//   1. Send text to Claude (Anthropic API) to detect if it's an event.
//   2. If event: create on the user's first write-capable Google Calendar.
//   3. Otherwise: save to brain_dump.
//
// Response shape:
//   { kind: 'event', title, date, time, html_link, calendar_label }   on event
//   { kind: 'brain', id, text }                                       on brain dump
//   { error: '...' }                                                  on failure

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasWriteScope, refreshAccessToken } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// --- helpers (duplicated from create-event/route.js to avoid coupling) ---

function computeEnd(date, time, mins) {
  const [h, m] = time.split(':').map(Number);
  const startMins = h * 60 + m;
  const totalMins = startMins + mins;
  const dayOffset = Math.floor(totalMins / 1440);
  const endH = Math.floor((totalMins % 1440) / 60);
  const endM = totalMins % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  if (dayOffset === 0) return { date, time: endTime };
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return { date: d.toISOString().slice(0, 10), time: endTime };
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getValidAccessToken(connection, supabase) {
  const expiresAt = new Date(connection.expires_at);
  if (expiresAt.getTime() - Date.now() > 60_000) return connection.access_token;
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

async function parseWithClaude(text, userTimezone, currentDate) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const system = `You are a parser that decides whether a short user note is a calendar event or just a task/thought.

Today's date in the user's timezone is ${currentDate} (timezone: ${userTimezone}).

Output ONLY a JSON object with these fields:
- is_event: boolean — true if the note describes something with a specific date/time
- title: string — the event/task title, cleaned up
- date: string YYYY-MM-DD or null — the date (interpret "tomorrow", "next Tuesday", etc. relative to today)
- time: string HH:MM (24-hour) or null — the start time
- duration_minutes: number — default 60 if not specified
- all_day: boolean — true for things like "dentist Friday" with no time

Only set is_event=true if there's a clear date or relative time reference. "Buy groceries" → is_event=false. "Dentist Friday" → is_event=true, all_day=true.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system,
        messages: [
          { role: 'user', content: text },
          { role: 'assistant', content: '{' },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.content?.[0]?.text || '';
    return JSON.parse('{' + content);
  } catch (err) {
    console.error('[Align] extension parse error:', err);
    return null;
  }
}

// --- handler ---

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const presented = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.VOICE_CAPTURE_TOKEN;
  const userId = process.env.VOICE_CAPTURE_USER_ID;
  if (!expected || !userId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500, headers: CORS_HEADERS });
  }
  if (!presented || presented !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  let body;
  try { body = await request.json(); } catch { body = { text: await request.text() }; }
  const text = (body.text || '').trim();
  const userTimezone = body.user_timezone || 'UTC';
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const currentDate = body.current_date || `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (!text) {
    return NextResponse.json({ error: 'missing_text' }, { status: 400, headers: CORS_HEADERS });
  }

  // Service-role client — we authenticated via shared secret, so bypass RLS is fine.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // 1. Try parsing as event via Claude.
  const parsed = await parseWithClaude(text, userTimezone, currentDate);

  // 2. If it looks like an event AND there's a Google connection, create it.
  if (parsed?.is_event && parsed.date) {
    try {
      const { data: connections } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');
      const connection = connections?.find(c => hasWriteScope(c));
      if (connection) {
        const token = await getValidAccessToken(connection, supabase);
        const calendarId = connection.write_calendar_id || 'primary';
        let eventBody;
        if (parsed.all_day || !parsed.time) {
          eventBody = {
            summary: parsed.title || text,
            start: { date: parsed.date },
            end: { date: addDays(parsed.date, 1) },
          };
        } else {
          const dur = parsed.duration_minutes && parsed.duration_minutes > 0 ? parsed.duration_minutes : 60;
          const end = computeEnd(parsed.date, parsed.time, dur);
          eventBody = {
            summary: parsed.title || text,
            start: { dateTime: `${parsed.date}T${parsed.time}:00`, timeZone: userTimezone },
            end:   { dateTime: `${end.date}T${end.time}:00`,         timeZone: userTimezone },
          };
        }
        const insertRes = await fetch(
          `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventBody),
          }
        );
        if (insertRes.ok) {
          const googleEvent = await insertRes.json();
          return NextResponse.json({
            kind: 'event',
            title: parsed.title || text,
            date: parsed.date,
            time: parsed.time,
            all_day: parsed.all_day || !parsed.time,
            html_link: googleEvent.htmlLink,
            calendar_label: connection.label,
          }, { headers: CORS_HEADERS });
        } else {
          // Couldn't create on Google; log but fall through to brain dump.
          const errText = await insertRes.text();
          console.error('[Align] extension event create failed:', insertRes.status, errText.slice(0, 300));
        }
      }
    } catch (err) {
      console.error('[Align] extension event branch error:', err);
      // fall through to brain dump
    }
  }

  // 3. Fall back: save to brain dump.
  const id = newId();
  const { error } = await supabase.from('brain_dump').insert({ id, user_id: userId, text });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  return NextResponse.json({ kind: 'brain', id, text }, { headers: CORS_HEADERS });
}
