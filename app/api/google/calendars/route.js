// GET /api/google/calendars
// Returns the calendar list for each of the user's Google connections.
// Used by the Settings drawer to populate the "Write to:" dropdown.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { refreshAccessToken, hasCalendarListScope } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

// Returns a fresh access token, refreshing + persisting if needed.
// Same logic as lib/google-calendar.js but lives here too so we don't
// cross-import between API routes.
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

async function fetchCalendarList(accessToken) {
  const res = await fetch(`${CALENDAR_LIST_URL}?minAccessRole=writer`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar list failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Only return what the UI needs.
  return (data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    accessRole: c.accessRole,
  }));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const { data: connections, error } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each connection, try to list calendars. If the connection lacks
  // the scope, return an empty list with a reason; the UI will offer
  // a "reconnect to choose" prompt instead of a dropdown.
  const results = await Promise.all(
    (connections || []).map(async (conn) => {
      if (!hasCalendarListScope(conn)) {
        return {
          google_email: conn.google_email,
          label: conn.label,
          write_calendar_id: conn.write_calendar_id,
          can_list: false,
          reason: 'scope_missing',
          calendars: [],
        };
      }
      try {
        const token = await getValidAccessToken(conn, supabase);
        const calendars = await fetchCalendarList(token);
        return {
          google_email: conn.google_email,
          label: conn.label,
          write_calendar_id: conn.write_calendar_id,
          can_list: true,
          calendars,
        };
      } catch (err) {
        console.error(`[Align] List calendars failed for ${conn.google_email}:`, err.message);
        return {
          google_email: conn.google_email,
          label: conn.label,
          write_calendar_id: conn.write_calendar_id,
          can_list: false,
          reason: 'fetch_failed',
          error: err.message,
          calendars: [],
        };
      }
    })
  );

  return NextResponse.json({ connections: results });
}
