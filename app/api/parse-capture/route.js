// POST /api/parse-capture
// Takes a quick-capture string and uses Claude to decide whether it's a
// scheduled EVENT (has a date/time) or a NOTE, and extracts the structured
// fields Quick Capture needs to create a Google Calendar event.
//
// Body: { text, today "YYYY-MM-DD", user_timezone }
// Returns: { type:"event"|"note", title, date|null, time|null, duration_minutes|null, all_day }
//
// Fails safe: on any error it returns { type:"note", title:text } so a capture
// is never lost — it just falls back to the brain dump.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { text, today, user_timezone } = await request.json().catch(() => ({}));
  const clean = (text || '').trim();
  if (!clean) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ type: 'note', title: clean });

  const system = `You convert a quick capture note into structured JSON for a weekly planner.
Today's date is ${today}. The user's timezone is ${user_timezone || 'UTC'}.

Decide whether the text describes a scheduled EVENT (a meeting, appointment, class, call, or anything with a date and/or a specific time) or a NOTE/todo (no clear time).

Resolve relative dates ("today", "tonight", "tomorrow", "next Monday", "Friday", "the 14th") against today's date.

Return ONLY minified JSON, no prose and no code fences, in exactly this shape:
{"type":"event"|"note","title":string,"date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"duration_minutes":number|null,"all_day":boolean}

Rules:
- type is "event" if there is any date OR time; otherwise "note".
- time is 24-hour "HH:MM", or null if no specific time is given.
- If a time is given but no date, use today's date.
- If a date is given but no time, set all_day true and time null.
- title is a short clean summary WITHOUT the date/time words (e.g. input "dentist tomorrow at 3pm" -> title "Dentist").
- duration_minutes: a number if a duration is implied (e.g. "1 hour" -> 60, "30 min call" -> 30), otherwise null.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: clean }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('[Align] parse-capture anthropic error', res.status, t.slice(0, 300));
      return NextResponse.json({ type: 'note', title: clean });
    }

    const data = await res.json();
    const raw = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return NextResponse.json({ type: 'note', title: clean });
    }

    // sanitize
    if (parsed.type !== 'event') parsed.type = 'note';
    if (!parsed.title || typeof parsed.title !== 'string') parsed.title = clean;
    if (parsed.type === 'note') { parsed.date = null; parsed.time = null; }
    parsed.all_day = !!parsed.all_day;

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[Align] parse-capture error', err);
    return NextResponse.json({ type: 'note', title: clean });
  }
}
