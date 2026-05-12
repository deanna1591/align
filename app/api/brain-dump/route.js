import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function authCheck(request) {
  const auth = request.headers.get('authorization') || '';
  const presented = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.VOICE_CAPTURE_TOKEN;
  const userId = process.env.VOICE_CAPTURE_USER_ID;
  if (!expected || !userId) return { error: 'voice_capture_not_configured', status: 500 };
  if (!presented || presented !== expected) return { error: 'unauthorized', status: 401 };
  return { userId };
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function GET(request) {
  const a = authCheck(request);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('brain_dump')
    .select('id, text, created_at')
    .eq('user_id', a.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function DELETE(request) {
  const a = authCheck(request);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('brain_dump')
    .delete()
    .eq('user_id', a.userId)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
