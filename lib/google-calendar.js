// Server-side helper for fetching calendar events from Google.
// Handles token refresh automatically.

import { refreshAccessToken } from './google-oauth';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

async function getValidAccessToken(connection, supabase) {
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();
  const bufferMs = 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
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

async function fetchCalendarEvents(accessToken, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar fetch failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.items || [];
}

function normalizeEvent(ev, connection) {
  const start = ev.start?.dateTime || ev.start?.date;
  const end = ev.end?.dateTime || ev.end?.date;
  const allDay = !ev.start?.dateTime;
  return {
    id: ev.id,
    title: ev.summary || '(no title)',
    start,
    end,
    allDay,
    location: ev.location || null,
    htmlLink: ev.htmlLink,
    source: connection.label,
    sourceEmail: connection.google_email,
  };
}

export async function fetchEventsForUser(supabase, userId, startDate, endDate) {
  const { data: connections, error } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  if (!connections || connections.length === 0) return { events: [], errors: [] };

  const timeMin = new Date(startDate);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(endDate);
  timeMax.setHours(23, 59, 59, 999);

  const events = [];
  const errors = [];

  for (const conn of connections) {
    try {
      const accessToken = await getValidAccessToken(conn, supabase);
      for (const calendarId of conn.calendar_ids || ['primary']) {
        const items = await fetchCalendarEvents(
          accessToken,
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
        for (const ev of items) {
          events.push(normalizeEvent(ev, conn));
        }
      }
    } catch (err) {
      console.error(`[Align] Fetch events failed for ${conn.google_email}:`, err.message);
      errors.push({ email: conn.google_email, message: err.message });
    }
  }

  return { events, errors };
}
