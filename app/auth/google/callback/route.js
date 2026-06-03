// GET /auth/google/callback?code=...&state=...
// Google redirects here after the user consents.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { exchangeCodeForTokens, fetchGoogleUserInfo } from '@/lib/google-oauth';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/?google_error=${encodeURIComponent(error)}`);
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(`${origin}/?google_error=missing_params`);
  }

  let state;
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
  } catch {
    return NextResponse.redirect(`${origin}/?google_error=bad_state`);
  }
  const { uid, label } = state;
  if (!uid) {
    return NextResponse.redirect(`${origin}/?google_error=no_uid`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== uid) {
    return NextResponse.redirect(`${origin}/login?google_error=auth_mismatch`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const info = await fetchGoogleUserInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Google returns granted scopes as a space-separated string.
    // We store them so the UI can tell whether this connection
    // has write permission without re-consenting.
    const grantedScopes = (tokens.scope || '').split(' ').filter(Boolean);

    const { error: upsertErr } = await supabase
      .from('google_calendar_connections')
      .upsert({
        user_id: uid,
        google_email: info.email,
        label,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scopes: grantedScopes,
        calendar_ids: ['primary'],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,google_email' });

    if (upsertErr) {
      console.error('[Align] Connection upsert failed:', upsertErr);
      return NextResponse.redirect(`${origin}/?google_error=${encodeURIComponent(upsertErr.message)}`);
    }

    return NextResponse.redirect(`${origin}/?google_connected=${encodeURIComponent(info.email)}`);
  } catch (err) {
    console.error('[Align] OAuth callback failed:', err);
    return NextResponse.redirect(`${origin}/?google_error=${encodeURIComponent(err.message)}`);
  }
}
