// app/api/remarkable/push/route.js
import { NextResponse } from 'next/server';
import { remarkable } from 'rmapi-js';
import { buildAgendaPdf } from '@/lib/remarkable-agenda';

export const runtime = 'nodejs';      // rmapi-js needs the Node runtime, not edge
export const maxDuration = 30;

// Verify the caller is a signed-in Align user by validating their Supabase
// access token. Self-contained — uses the public Supabase URL + anon key.
async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: key },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const deviceToken = process.env.REMARKABLE_TOKEN;
  if (!deviceToken) {
    return NextResponse.json(
      { error: 'reMarkable is not connected. Set REMARKABLE_TOKEN in your environment.' },
      { status: 503 },
    );
  }

  let body = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const { title, dateLabel, tasks = [], events = [] } = body;

  try {
    const bytes = await buildAgendaPdf({ dateLabel, tasks, events });
    const api = await remarkable(deviceToken);
    const name = title || `align — ${dateLabel || 'today'}`;
    const entry = await api.uploadPdf(name, bytes);
    return NextResponse.json({ ok: true, id: entry?.id ?? null, name });
  } catch (e) {
    console.error('[reMarkable push]', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to upload to reMarkable' },
      { status: 502 },
    );
  }
}
