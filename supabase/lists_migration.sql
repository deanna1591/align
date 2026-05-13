-- Lists feature: custom user-created lists (Grocery, To Buy, etc.) and items within them.

create table if not exists public.lists (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id text primary key,
  list_id text not null references public.lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  completed boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists list_items_list_id_idx on public.list_items(list_id);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "Lists: select own" on public.lists for select using (auth.uid() = user_id);
create policy "Lists: insert own" on public.lists for insert with check (auth.uid() = user_id);
create policy "Lists: update own" on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Lists: delete own" on public.lists for delete using (auth.uid() = user_id);

create policy "List items: select own" on public.list_items for select using (auth.uid() = user_id);
create policy "List items: insert own" on public.list_items for insert with check (auth.uid() = user_id);
create policy "List items: update own" on public.list_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "List items: delete own" on public.list_items for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
