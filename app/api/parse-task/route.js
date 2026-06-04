// POST /api/parse-task
// Sends a natural-language task to Claude and returns structured event data.
// Used by the task input on Enter — if the result has is_event=true, the UI
// pops a confirmation modal asking whether to create a Google Calendar event.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT =
  'You are a parser that extracts event details from natural-language tasks. Return only a JSON object. No prose, no markdown, no code fences.';

function buildUserPrompt({ text, user_timezone, current_date }) {
  return `Current date in user's timezone: ${current_date}
User's timezone: ${user_timezone}
Task: "${text.replace(/"/g, '\\"')}"

Return a JSON object with these fields:
- is_event: boolean — true if the task has a specific date or time, false if it's just an open-ended action
- title: string — the action portion, with date/time language stripped out (e.g., "grocery with T")
- date: string "YYYY-MM-DD" in the user's timezone (only if is_event is true)
- time: string "HH:MM" 24-hour format (only if a specific time was mentioned)
- duration_minutes: integer (default 60 if not stated; preserve user-stated durations like "for 30 mins")
- all_day: boolean (true if a date was given but no specific time)

Be conservative with is_event: only set it true when there's a clear date and/or time signal.
Resolve relative dates ("tomorrow", "next Tuesday", "Friday") against the current date.

Examples:
"grocery with T tomorrow at 3pm" → {"is_event":true,"title":"grocery with T","date":"<tomorrow>","time":"15:00","duration_minutes":60,"all_day":false}
"call mom" → {"is_event":false,"title":"call mom"}
"dentist next Tuesday" → {"is_event":true,"title":"dentist","date":"<next tuesday>","duration_minutes":60,"all_day":true}
"lunch with sarah friday at noon for 90 mins" → {"is_event":true,"title":"lunch with sarah","date":"<friday>","time":"12:00","duration_minutes":90,"all_day":false}
"deep clean kitchen" → {"is_event":false,"title":"deep clean kitchen"}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[Align] ANTHROPIC_API_KEY not set');
    return NextResponse.json({ error: 'api_key_missing' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { text, user_timezone, current_date } = body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'missing_text' }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: 'text_too_long' }, { status: 400 });
  }

  const tz = user_timezone || 'UTC';
  const today = current_date || new Date().toISOString().slice(0, 10);

  try {
    const apiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: buildUserPrompt({ text: text.trim(), user_timezone: tz, current_date: today }) },
          // Prefill the assistant turn with `{` to force a JSON response.
          { role: 'assistant', content: '{' },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('[Align] Claude API error:', apiRes.status, errText.slice(0, 500));
      return NextResponse.json({ error: 'parse_failed', status: apiRes.status }, { status: 502 });
    }

    const data = await apiRes.json();
    const raw = data.content?.[0]?.text || '';
    // The prefill `{` is NOT included in the response — prepend it.
    const jsonText = '{' + raw;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error('[Align] JSON parse failed:', jsonText.slice(0, 200));
      return NextResponse.json({ error: 'invalid_json_response' }, { status: 502 });
    }

    // Light sanity check on the parsed payload before returning.
    if (typeof parsed.is_event !== 'boolean' || typeof parsed.title !== 'string') {
      console.error('[Align] Parsed payload missing required fields:', parsed);
      return NextResponse.json({ error: 'malformed_parse' }, { status: 502 });
    }

    return NextResponse.json({ parsed });
  } catch (err) {
    console.error('[Align] parse-task error:', err);
    return NextResponse.json({ error: err.message || 'unknown_error' }, { status: 500 });
  }
}
