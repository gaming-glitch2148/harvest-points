# Harvest Points

A simple browser game where players gain points by cutting wheat and lose points for cutting corn or other crops.

Players can play solo, create a live online room for two devices, and submit scores to a shared leaderboard.

## Game rules

- Wheat: +10
- Golden Wheat: +30
- Corn: -10
- Carrot/Tomato: -5
- Empty soil: 0

## Local setup

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Online play setup

Online matches and the shared leaderboard use Supabase.

1. Create a Supabase project.
2. Open the SQL editor.
3. Run this setup SQL:

```sql
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
```

4. In Supabase, enable Realtime for the `rooms` and `leaderboard` tables.
5. Copy `.env.example` to `.env.local`.
6. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase project settings.
7. Restart `npm run dev`.

These policies are intentionally open for quick testing. Tighten them before sharing the app widely.

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Create a new GitHub repository named `harvest-points`.
2. Upload/push these files to the repo.
3. In Vercel, choose **Add New > Project**.
4. Import the GitHub repo.
5. Use these settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add the same `VITE_SUPABASE_*` environment variables in Vercel.
7. Deploy.
