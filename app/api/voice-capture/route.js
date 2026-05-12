import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const presented = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.VOICE_CAPTURE_TOKEN;
  const userId = process.env.VOICE_CAPTURE_USER_ID;

  if (!expected || !userId) return NextResponse.json({ error: 'voice_capture_not_configured' }, { status: 500, headers: CORS_HEADERS });
  if (!presented || presented !== expected) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: CORS_HEADERS });

  let body;
  try { body = await request.json(); } catch { body = { text: await request.text() }; }
  const text = (body.text || '').trim();
  if (!text) return NextResponse.json({ error: 'missing_text' }, { status: 400, headers: CORS_HEADERS });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const id = newId();
  const { error } = await supabase.from('brain_dump').insert({ id, user_id: userId, text });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ ok: true, id, text }, { headers: CORS_HEADERS });
}
