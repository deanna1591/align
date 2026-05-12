-- ============================================================
--  Align schema
--  Paste this into Supabase: SQL Editor > New query > Run
-- ============================================================

-- Tasks: one row per task, grouped by date in app code.
create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  text text not null,
  completed boolean not null default false,
  started boolean not null default false,
  started_at timestamptz,
  notes text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks(user_id, date);

-- Brain dump: ungrouped, untimed thoughts.
create table if not exists public.brain_dump (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists brain_dump_user_created_idx on public.brain_dump(user_id, created_at desc);

-- Stats: one row per user — streak, last active date.
create table if not exists public.stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- ============================================================
--  Row-Level Security
--  Each user can only see and modify their own rows.
-- ============================================================

alter table public.tasks enable row level security;
alter table public.brain_dump enable row level security;
alter table public.stats enable row level security;

create policy "Tasks: select own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "Tasks: insert own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "Tasks: update own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Tasks: delete own" on public.tasks
  for delete using (auth.uid() = user_id);

create policy "Brain: select own" on public.brain_dump
  for select using (auth.uid() = user_id);
create policy "Brain: insert own" on public.brain_dump
  for insert with check (auth.uid() = user_id);
create policy "Brain: update own" on public.brain_dump
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Brain: delete own" on public.brain_dump
  for delete using (auth.uid() = user_id);

create policy "Stats: select own" on public.stats
  for select using (auth.uid() = user_id);
create policy "Stats: insert own" on public.stats
  for insert with check (auth.uid() = user_id);
create policy "Stats: update own" on public.stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  Enable real-time
--  Required for live sync across devices.
-- ============================================================

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.brain_dump;
alter publication supabase_realtime add table public.stats;
