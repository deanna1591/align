// Google OAuth + Calendar API helpers.
// Used by route handlers; runs server-side only.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Read+write events on any calendar the user owns.
export const CALENDAR_WRITE_SCOPE =
  'https://www.googleapis.com/auth/calendar.events';

// Required to list the user's calendars (so they can pick which one
// Align writes to). Slightly over-scoped — it also grants event read
// access — but the narrower calendar.calendarlist.readonly scope is
// not universally supported. calendar.readonly is the safe choice.
export const CALENDAR_LIST_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly';

const SCOPES = ['openid', 'email', CALENDAR_WRITE_SCOPE, CALENDAR_LIST_SCOPE];

// Helpers for the UI: which capabilities does this connection have?
export function hasWriteScope(connection) {
  return Array.isArray(connection?.scopes) && connection.scopes.includes(CALENDAR_WRITE_SCOPE);
}
export function hasCalendarListScope(connection) {
  return Array.isArray(connection?.scopes) && connection.scopes.includes(CALENDAR_LIST_SCOPE);
}

export function getRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL not set');
  return `${base}/auth/google/callback`;
}

// Build the URL to send the user to for consent.
// `state` is opaque data we want returned to us — we use it to pass our Supabase user id.
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',      // gets us a refresh_token
    prompt: 'consent',           // forces refresh_token even on re-auth
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Exchange the one-time `code` (from Google's redirect) for tokens.
export async function exchangeCodeForTokens(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, scope, token_type, id_token }
}

// Fetch the email + profile for the user who just authed.
export async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`User info failed: ${res.status}`);
  return res.json();
}

// Use a refresh token to get a new access token.
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}
