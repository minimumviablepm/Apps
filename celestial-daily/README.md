# Celestial Daily

A daily zodiac app. Readings, stats, cosmic matches, and a shareable 1080x1920 card graphic, all generated deterministically per sign per day so the whole app refreshes at midnight.

## Run locally

```bash
npm install
npm run dev
```

## Push to GitHub

Option A, new repository:

1. Create an empty repo at github.com/new (no README, no .gitignore)
2. From this folder:

```bash
git init
git add .
git commit -m "Add Celestial Daily zodiac app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/celestial-daily.git
git push -u origin main
```

Option B, existing repository:

```bash
cp -r celestial-daily /path/to/your-repo/
cd /path/to/your-repo
git add celestial-daily
git commit -m "Add Celestial Daily zodiac app"
git push
```

Option C, no command line: on github.com, open your repo, Add file > Upload files, and drag this folder's contents in.

## Deploy

Any static host works. `npm run build` outputs to `dist/`. On Vercel or Netlify, import the repo and accept the Vite defaults.

## Notes

- Readings are composed from copy pools seeded by date and sign. No real ephemeris is involved.
- The share card renders to an offscreen canvas and exports via the native share sheet with a PNG download fallback.
- No localStorage is used; state is in-memory by design.
