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
3. Run `supabase/sql/setup.sql`, or run `supabase/sql/001_schema.sql` and then `supabase/sql/002_policies.sql`.
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
