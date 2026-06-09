// POST /api/google/delete-event
// Deletes an event from the user's connected Google Calendar (and cleans up the
// align_events link if present). Auth: Supabase session.
//
// Body: { google_email, calendar_id, event_id }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { refreshAccessToken } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const googleEmail = body.google_email;
  const calendarId = body.calendar_id || 'primary';
  const eventId = body.event_id;

  if (!eventId) {
    return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  // Find the connection this event came from. If no email was supplied, fall back
  // to the user's first connection.
  let query = supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', user.id);
  if (googleEmail) query = query.eq('google_email', googleEmail);

  const { data: connections, error: connErr } = await query;
  if (connErr) {
    console.error('[Align] delete-event connection lookup error:', connErr);
    return NextResponse.json({ error: 'connection_lookup_failed' }, { status: 500 });
  }
  const conn = connections?.[0];
  if (!conn) {
    return NextResponse.json({ error: 'no_matching_connection' }, { status: 404 });
  }

  // Get a valid access token (refresh + persist if expired).
  let accessToken = conn.access_token;
  try {
    const expiresAt = new Date(conn.expires_at).getTime();
    if (!conn.expires_at || expiresAt - Date.now() < 60_000) {
      const refreshed = await refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      await supabase
        .from('google_calendar_connections')
        .update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('google_email', conn.google_email);
    }
  } catch (err) {
    console.error('[Align] delete-event token refresh failed:', err.message);
    return NextResponse.json({ error: 'token_refresh_failed', detail: err.message }, { status: 502 });
  }

  // Call Google Calendar DELETE.
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  let googleStatus;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    googleStatus = res.status;

    // 204 = deleted. 404/410 = already gone (treat as success so the UI stays consistent).
    if (res.status !== 204 && res.status !== 404 && res.status !== 410) {
      const text = await res.text();
      console.error('[Align] Google delete failed:', res.status, text.slice(0, 300));
      // 403 usually means the calendar is connected read-only (no calendar.events write scope),
      // or the event isn't owned by this account.
      if (res.status === 403) {
        return NextResponse.json({
          error: 'permission_denied',
          detail: 'This calendar may be connected read-only, or you don\'t own this event. Reconnect with write access in Settings.',
        }, { status: 403 });
      }
      return NextResponse.json({ error: 'google_delete_failed', status: res.status, detail: text.slice(0, 200) }, { status: 502 });
    }
  } catch (err) {
    console.error('[Align] delete-event fetch error:', err);
    return NextResponse.json({ error: 'network_error', detail: err.message }, { status: 502 });
  }

  // Best-effort cleanup of the align_events link. Ignore errors (table/columns may vary).
  try {
    await supabase
      .from('align_events')
      .delete()
      .eq('user_id', user.id)
      .eq('google_event_id', eventId);
  } catch (e) {
    // non-fatal
  }

  return NextResponse.json({ ok: true, googleStatus });
}
