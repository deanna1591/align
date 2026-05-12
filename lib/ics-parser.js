import * as ical from 'node-ical';

const pad = (n) => String(n).padStart(2, '0');

function formatDateOnly(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function normalizeEvent({ uid, summary, location, start, end, allDay, feed, occKey }) {
  return {
    id: occKey ? `${uid}-${occKey}` : uid,
    title: summary || '(no title)',
    start: allDay ? formatDateOnly(start) : start.toISOString(),
    end: end ? (allDay ? formatDateOnly(end) : end.toISOString()) : null,
    allDay,
    location: location || null,
    htmlLink: null,
    source: feed.label,
    sourceEmail: '',
  };
}

export async function fetchEventsFromIcsFeeds(supabase, userId, startDate, endDate) {
  const { data: feeds, error } = await supabase
    .from('calendar_feeds')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  if (!feeds || feeds.length === 0) return { events: [], errors: [] };

  const events = [];
  const errors = [];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.ics_url, { cache: 'no-store' });
      if (!res.ok) {
        errors.push({ label: feed.label, message: `HTTP ${res.status}` });
        continue;
      }
      const text = await res.text();
      const data = ical.sync.parseICS(text);

      for (const k of Object.keys(data)) {
        const ev = data[k];
        if (ev.type !== 'VEVENT') continue;

        const allDay = ev.datetype === 'date';
        const baseProps = { uid: ev.uid, summary: ev.summary, location: ev.location, allDay, feed };

        if (ev.rrule) {
          const occurrences = ev.rrule.between(startDate, endDate, true);
          const exdates = new Set(
            Object.values(ev.exdate || {}).map((d) => d.toISOString())
          );
          const overrides = {};
          for (const r of Object.values(ev.recurrences || {})) {
            if (r.recurrenceid) overrides[r.recurrenceid.toISOString()] = r;
          }
          const baseDuration = ev.end && ev.start ? ev.end.getTime() - ev.start.getTime() : 0;

          for (const occStart of occurrences) {
            if (exdates.has(occStart.toISOString())) continue;
            const override = overrides[occStart.toISOString()];
            const item = override || ev;
            const start = override?.start || occStart;
            const end = override?.end || new Date(occStart.getTime() + baseDuration);
            events.push(normalizeEvent({
              ...baseProps,
              uid: ev.uid,
              summary: item.summary,
              location: item.location,
              start,
              end,
              occKey: occStart.getTime(),
            }));
          }
        } else {
          if (!ev.start) continue;
          if (ev.start < startDate || ev.start > endDate) continue;
          events.push(normalizeEvent({
            ...baseProps,
            start: ev.start,
            end: ev.end,
          }));
        }
      }
    } catch (err) {
      console.error(`[Align] ICS parse failed for ${feed.label}:`, err.message);
      errors.push({ label: feed.label, message: err.message });
    }
  }

  return { events, errors };
}
