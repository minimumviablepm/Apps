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

## Fastest path: free demo (no key, no cost)

Want a live URL to click through right now, with no Keepa key and no secrets?

1. In Render: **New +  →  Blueprint**, pick this repo (or use a "Deploy to
   Render" button). Render auto-detects the root **`render.yaml`**, which is the
   free demo: `plan: free`, synthetic data, no disk.
2. Deploy. On first boot it **self-seeds** the synthetic catalog and serves the
   full UI + API at the URL Render gives you.

That's the real app and real scoring — only the *data* is synthetic. (Free Render
services sleep after ~15 min idle and take ~50s to wake; fine for a demo.)
When you're ready for real deals, follow the section below.

## Real product (Render Blueprint)

The real product needs an always-on instance with a persistent disk (so the
database survives restarts) and a real data source. Use the settings in
**`prime-day-engine/render.real.yaml`** — copy them over the root `render.yaml`
(or edit the service in the dashboard to match): `plan: starter`, a 1 GB disk at
`/data`, `PDE_INGEST_SOURCE=keepa`, and the scheduler enabled.

1. Push this repo to GitHub (already done if you're reading this on the PR).
2. In Render: **New +  →  Blueprint** with the real-product settings applied.
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

## Free option: PA-API "lite" mode (no Keepa subscription)

If you don't want to pay for Keepa, the engine can run on Amazon's **official,
free** Product Advertising API instead. Honest trade-offs:

- PA-API gives the **current price only**, so the engine **records each reading**
  and builds its **own price history over time** (`history.py`). It's weak on day
  one — nothing qualifies until it has seen prices drop below their recorded
  average — and gets better the longer it runs.
- PA-API does **not** return numeric star ratings / review counts, so lite mode
  **skips the quality gate and Pillar C** and scores on the two price pillars
  (Deal Strength + Exclusivity, reweighted 60/40, configurable).

**What you need:**

1. An **Amazon Associates** account approved for PA-API. Approval requires **3
   qualifying sales within 180 days** of signing up — so you typically launch with
   affiliate links first, make a few sales, then PA-API access unlocks.
2. From Associates Central → Tools → Product Advertising API, generate your
   **Access Key** and **Secret Key** and note your **Partner Tag** (store id).
3. A watchlist: ASINs to track (`PDE_PAAPI_ASINS`) and/or keywords to discover
   them (`PDE_PAAPI_KEYWORDS`). PA-API has no Keepa-style "find all deals", so you
   curate what to watch.

**To use it on Render**, change these env vars (instead of the Keepa ones):

```
PDE_INGEST_SOURCE = paapi
PDE_LITE_MODE     = 1
PAAPI_ACCESS_KEY  = <your key>      (secret)
PAAPI_SECRET_KEY  = <your secret>   (secret)
PAAPI_PARTNER_TAG = <your store id>
PAAPI_COUNTRY     = US
PDE_PAAPI_KEYWORDS = "robot vacuum, air fryer, headphones"   (or PDE_PAAPI_ASINS)
```

and `pip install python-amazon-paapi` (already in `requirements.txt`). Locally:

```bash
PDE_INGEST_SOURCE=paapi PDE_LITE_MODE=1 python seed.py --source paapi
```

### Which source should I use?

| | Keepa | PA-API lite | Mock |
|---|---|---|---|
| Cost | ~€49/mo | Free | Free |
| Real deals | ✅ | ✅ (curated watchlist) | ❌ demo data |
| Price history | ✅ immediately | ⚠️ builds over weeks | n/a |
| Quality/ratings scoring | ✅ | ❌ (price pillars only) | ✅ |
| Setup | API key | Associates approval | none |

## Vercel alternative

If you specifically want Vercel: keep the frontend there as a static site, and
move the data layer to a managed Postgres (Vercel Postgres / Neon) with the API
as Python serverless functions and a Vercel Cron job hitting an ingest endpoint.
That needs a Postgres port of `db.py` (swap `sqlite3` for `psycopg`, `?` → `%s`).
Ask and I'll do that port — but Render above is the lower-effort path.
