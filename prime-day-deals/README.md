# Prime Day Deals

A little single-page app to count down to Amazon Prime Day and track the deals
you actually care about.

## Features

- **Live countdown** to Prime Day (date is editable — Amazon usually runs it in
  July, so it defaults to Jul 8, 2026 until the real date is announced).
- **Watchlist** of items with list price and your target price.
- **Savings tracker** — see potential savings across everything you're watching
  and locked-in savings for items you've already snagged.
- Everything persists in `localStorage`, so your list survives a refresh.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL.

## Build

```bash
npm run build
npm run preview
```

## Tech

Vite + React, no other dependencies.
