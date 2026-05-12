import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const newTaskId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const presented = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = process.env.VOICE_CAPTURE_TOKEN;
  const userId = process.env.VOICE_CAPTURE_USER_ID;
  if (!expected || !userId) return NextResponse.json({ error: 'voice_capture_not_configured' }, { status: 500 });
  if (!presented || presented !== expected) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const id = (body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: bd, error: fetchErr } = await supabase
    .from('brain_dump')
    .select('id, text, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !bd) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const taskId = newTaskId();
  const { error: insertErr } = await supabase
    .from('tasks')
    .insert({
      id: taskId,
      user_id: userId,
      date: todayKey(),
      text: bd.text,
      completed: false,
      started: false,
    });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await supabase.from('brain_dump').delete().eq('id', id).eq('user_id', userId);

  return NextResponse.json({ ok: true, task_id: taskId });
}
