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

Online matches and the shared leaderboard use Firebase Realtime Database.

1. Create a Firebase project.
2. Add a Web app in Firebase project settings.
3. Create a Realtime Database.
4. Copy `.env.example` to `.env.local`.
5. Fill in the `VITE_FIREBASE_*` values from the Firebase Web app config.
6. Restart `npm run dev`.

For a simple public prototype, use these Realtime Database rules:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    },
    "leaderboard": {
      ".read": true,
      ".write": true,
      ".indexOn": ["score"]
    }
  }
}
```

These rules are intentionally open for quick testing. Tighten them before sharing the app widely.

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
6. Add the same `VITE_FIREBASE_*` environment variables in Vercel.
7. Deploy.
