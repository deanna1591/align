import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchEventsFromIcsFeeds } from '@/lib/ics-parser';
import { fetchEventsForUser as fetchGoogleEvents } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'missing_dates' }, { status: 400 });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  // Fetch both event sources in parallel. Either failing doesn't take
  // the other down — we surface partial results plus a per-source error.
  const [icsResult, googleResult] = await Promise.allSettled([
    fetchEventsFromIcsFeeds(supabase, user.id, startDate, endDate),
    fetchGoogleEvents(supabase, user.id, startDate, endDate),
  ]);

  const events = [];
  const errors = [];

  if (icsResult.status === 'fulfilled') {
    events.push(...icsResult.value.events);
    errors.push(...(icsResult.value.errors || []).map(e => ({ source: 'ical', ...e })));
  } else {
    console.error('[Align] iCal fetch threw:', icsResult.reason);
    errors.push({ source: 'ical', message: icsResult.reason?.message || 'unknown error' });
  }

  if (googleResult.status === 'fulfilled') {
    events.push(...googleResult.value.events);
    errors.push(...(googleResult.value.errors || []).map(e => ({ source: 'google', ...e })));
  } else {
    console.error('[Align] Google fetch threw:', googleResult.reason);
    errors.push({ source: 'google', message: googleResult.reason?.message || 'unknown error' });
  }

  return NextResponse.json({ events, errors });
}
