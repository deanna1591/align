import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// POST /api/delete-account
// Permanently deletes the signed-in user's auth account. All of their rows
// (tasks, brain_dump, stats, etc.) are removed automatically because every
// table references auth.users(id) ON DELETE CASCADE.
//
// Auth: the client sends its Supabase access token as a Bearer header. We
// verify it with the anon client to learn *who* is calling, then use the
// service-role client to delete exactly that user — so a user can only ever
// delete their own account.
export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'server_not_configured' }, { status: 500 });
  }

  // 1) Identify the caller from their access token.
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = userData.user.id;

  // 2) Delete that user with admin privileges. Cascading FKs remove their data.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json({ error: 'delete_failed', detail: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
