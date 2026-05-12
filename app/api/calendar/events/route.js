import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchEventsFromIcsFeeds } from '@/lib/ics-parser';

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

  try {
    const result = await fetchEventsFromIcsFeeds(
      supabase,
      user.id,
      new Date(start),
      new Date(end)
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Align] Events route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
