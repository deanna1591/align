// POST /auth/google/disconnect

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const googleEmail = body.google_email;
  if (!googleEmail) return NextResponse.json({ error: 'missing_email' }, { status: 400 });

  const { error } = await supabase
    .from('google_calendar_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('google_email', googleEmail);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
