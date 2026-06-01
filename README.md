# Harvest Points

A simple browser game where players gain points by cutting wheat and lose points for cutting corn or other crops.

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
6. Deploy.

No environment variables are required.
