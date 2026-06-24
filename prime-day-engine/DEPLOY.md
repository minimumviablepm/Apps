# Deploying the Prime Day Deal Engine

This app is a Python API + a database + a scheduled ingest job, all served as
**one always-on web service**. That makes Render the easiest host. (Vercel is
serverless — no persistent disk and no always-on scheduler — so it would force a
Postgres + Vercel-Cron rewrite. See "Vercel alternative" at the bottom.)

## Prerequisites

1. **Keepa API key** — the only way to get *real* deals. Paid subscription from
   <https://keepa.com/#!api> (minimum tier ~€49/month = 20 tokens/min, which is
   enough for a personal deployment; the ingest batches + resumes within quota).
2. **(Optional) Amazon Associates tag** — for affiliate links. Links work
   without it; the tag just earns referral credit.
3. A **Render** account (<https://render.com>) connected to this GitHub repo.

## One-time deploy (Render Blueprint)

1. Push this repo to GitHub (already done if you're reading this on the PR).
2. In Render: **New +  →  Blueprint**, pick this repo. Render reads
   `prime-day-engine/render.yaml` and creates the web service + persistent disk.
3. When prompted (or under the service's **Environment** tab) set the secrets:
   - `KEEPA_API_KEY` = your Keepa key
   - `PDE_KEEPA_CATEGORIES` = the Keepa category **node ids** to ingest,
     comma-separated, e.g. `172282,1055398` (Electronics, Home & Kitchen).
     Find node ids on Keepa or via the `keepa` library's category search.
   - `PDE_AFFILIATE_TAG` = your Associates tag (optional)
4. Click **Apply / Deploy**.

On boot the service runs a **baseline ingest** in the background, then refreshes
at 00:00 / 09:00 / 15:00 (configurable via `PDE_INGEST_HOURS`). The first run can
take a while on the 20-token tier — the site serves an empty state until the
first batch lands, then fills in.

Your app is live at the service URL Render gives you (e.g.
`https://prime-day-engine.onrender.com`) — frontend and API on the same origin.

## Verifying

- `GET /healthz` → `{"status":"ok"}`
- `GET /api/deals` → the curated list
- The root URL serves the UI.

## Cost summary

| Item | ~Cost |
|---|---|
| Keepa API (minimum tier) | €49 / month |
| Render Starter web service + 1 GB disk | ~$7 / month |
| Amazon Associates | free |

## Environment variables (full list)

All have sensible defaults except the secrets. See `backend/config.py`.

| Var | Purpose |
|---|---|
| `KEEPA_API_KEY` | Keepa API key (required for real data) |
| `PDE_KEEPA_CATEGORIES` | Keepa node ids to ingest (comma-separated) |
| `PDE_INGEST_SOURCE` | `keepa` for real data, `mock` for synthetic |
| `PDE_ENABLE_SCHEDULER` | `1` to run the in-process 3x-daily ingest |
| `PDE_INGEST_HOURS` | ingest hours, default `0,9,15` |
| `PDE_DB_PATH` | database path (point at the persistent disk) |
| `PDE_AFFILIATE_TAG` | Amazon Associates tag |
| pillar weights, gate thresholds, etc. | see `backend/config.py` (`PDE_*`) |

## Try it live with mock data first (no Keepa key)

Want to see it running before paying for Keepa? Set `PDE_INGEST_SOURCE=mock` (and
you can leave `KEEPA_API_KEY` unset). The same deploy then serves the synthetic
catalog so you can click through the real UI immediately.

## Vercel alternative

If you specifically want Vercel: keep the frontend there as a static site, and
move the data layer to a managed Postgres (Vercel Postgres / Neon) with the API
as Python serverless functions and a Vercel Cron job hitting an ingest endpoint.
That needs a Postgres port of `db.py` (swap `sqlite3` for `psycopg`, `?` → `%s`).
Ask and I'll do that port — but Render above is the lower-effort path.
