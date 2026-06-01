create table if not exists public.rooms (
  code text primary key,
  status text not null default 'waiting',
  started_at bigint,
  players jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  mode text not null default 'solo',
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
alter table public.leaderboard enable row level security;

create policy "public rooms read" on public.rooms for select using (true);
create policy "public rooms insert" on public.rooms for insert with check (true);
create policy "public rooms update" on public.rooms for update using (true) with check (true);

create policy "public leaderboard read" on public.leaderboard for select using (true);
create policy "public leaderboard insert" on public.leaderboard for insert with check (true);
