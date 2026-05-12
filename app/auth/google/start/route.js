// GET /auth/google/start?label=Personal
// Redirects to Google's consent screen.
// Caller-supplied `label` ("Personal" / "Work") is round-tripped via the state param
// so we can store it when the callback fires.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildAuthUrl } from '@/lib/google-oauth';

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const label = searchParams.get('label') || 'Personal';

  // state encodes our user id + the chosen label, base64-encoded.
  // Google bounces this back to us untouched on callback.
  const state = Buffer.from(JSON.stringify({ uid: user.id, label })).toString('base64url');

  return NextResponse.redirect(buildAuthUrl(state));
}
