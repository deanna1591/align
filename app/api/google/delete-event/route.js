// POST /api/google/delete-event
// Body: { google_email, calendar_id, event_id }
// Deletes the event from Google Calendar AND removes the row from align_events
// (if it was originally created from Align). Both are own-row protected by RLS.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getValidAccessToken } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { google_email, calendar_id, event_id } = body;
  if (!google_email || !calendar_id || !event_id) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Confirm the connection belongs to this user (RLS would catch it too,
  // but better to fail fast with a clear error).
  const { data: connection, error: connErr } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('google_email', google_email)
    .maybeSingle();
  if (connErr) {
    return NextResponse.json({ error: connErr.message }, { status: 500 });
  }
  if (!connection) {
    return NextResponse.json({ error: 'connection_not_found' }, { status: 404 });
  }

  try {
    const token = await getValidAccessToken(connection, supabase);
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Google returns 204 No Content on success, 410 Gone if already deleted.
    if (!res.ok && res.status !== 410) {
      const text = await res.text();
      console.error('[Align] delete-event failed:', res.status, text.slice(0, 300));
      return NextResponse.json(
        { error: 'delete_failed', status: res.status, detail: text.slice(0, 300) },
        { status: 502 }
      );
    }

    // Clean up the linking row if the event was created via Align.
    // Non-fatal — even if this fails, the Google delete already succeeded.
    const { error: linkErr } = await supabase
      .from('align_events')
      .delete()
      .eq('user_id', user.id)
      .eq('google_event_id', event_id)
      .eq('google_calendar_id', calendar_id);
    if (linkErr) {
      console.error('[Align] align_events cleanup failed:', linkErr.message);
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[Align] delete-event error:', err);
    return NextResponse.json({ error: err.message || 'unknown' }, { status: 500 });
  }
}
