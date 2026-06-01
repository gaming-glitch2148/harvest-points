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
