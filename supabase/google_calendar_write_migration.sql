-- ============================================================
--  Align — Google Calendar WRITE feature (Phase 1 schema)
--
--  Extends the existing google_calendar_connections table with
--  write-target + scope tracking, and adds align_events to map
--  Align tasks to the Google events they created.
--
--  Run in Supabase: SQL Editor > New query > Run.
--  Idempotent: safe to run multiple times.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Extend google_calendar_connections
-- ------------------------------------------------------------

-- The calendar new events are written to. 'primary' is Google's alias
-- for the user's primary calendar, so this is a safe default for both
-- existing rows (backfill) and new rows.
alter table public.google_calendar_connections
  add column if not exists write_calendar_id text not null default 'primary';

-- The OAuth scopes this connection was actually granted.
-- We add it nullable, backfill existing rows with the scopes the v1
-- code requested, then set NOT NULL. Going forward, the OAuth callback
-- will populate this from Google's token response.
alter table public.google_calendar_connections
  add column if not exists scopes text[];

update public.google_calendar_connections
set scopes = array[
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
]
where scopes is null;

alter table public.google_calendar_connections
  alter column scopes set not null,
  alter column scopes set default '{}';


-- ------------------------------------------------------------
-- 2. align_events — tracks events Align created in Google.
--    Used to: avoid duplicate writes, show "View in Google" links,
--    and (post-v1) update/delete the Google event when the task changes.
-- ------------------------------------------------------------

create table if not exists public.align_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  align_task_id       text not null references public.tasks(id) on delete cascade,
  google_event_id     text not null,
  google_calendar_id  text not null,
  created_at          timestamptz not null default now(),
  unique (user_id, google_event_id, google_calendar_id)
);

create index if not exists align_events_user_task_idx
  on public.align_events(user_id, align_task_id);


-- ------------------------------------------------------------
-- 3. RLS on align_events — same "own row" pattern as the rest of the schema.
-- ------------------------------------------------------------

alter table public.align_events enable row level security;

drop policy if exists "Align events: select own" on public.align_events;
create policy "Align events: select own" on public.align_events
  for select using (auth.uid() = user_id);

drop policy if exists "Align events: insert own" on public.align_events;
create policy "Align events: insert own" on public.align_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "Align events: update own" on public.align_events;
create policy "Align events: update own" on public.align_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Align events: delete own" on public.align_events;
create policy "Align events: delete own" on public.align_events
  for delete using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. Realtime (optional)
--    Leave off for v1. Enable later if the UI subscribes to align_events.
-- ------------------------------------------------------------

-- alter publication supabase_realtime add table public.align_events;
