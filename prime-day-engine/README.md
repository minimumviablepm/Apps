# Prime Day Deal Engine — "The Ultimate Prime Day List"

A trustworthy, filterable list of Prime Day deals that are **simultaneously**:

1. **genuinely discounted** vs the item's own price history (not a fake markdown),
2. **genuinely high-quality** and peer-validated (not a cheap-but-bad product), and
3. **genuinely time-limited** (a rare price, not a perennial sale).

Every qualified product gets **Monica's Deal Score (0–100)** — a weighted blend of
Deal Strength (40%), Exclusivity (30%), and Quality vs Peers (30%). Built to the
PRD in this repo (`PRD.md`).

---

## Why this structure

The PRD's recommended production stack is Keepa + PostgreSQL + FastAPI + Next.js.
This repo is laid out so the **engine core runs anywhere with zero install**, and
the production stack is a drop-in:

| Concern | Runs offline now (stdlib) | Production drop-in (PRD Section 13) |
|---|---|---|
| Data source | `ingestion/mock_source.py` (synthetic) | `ingestion/keepa_source.py` (`pip install keepa`, `KEEPA_API_KEY`) |
| Storage | SQLite (`db.py`) | PostgreSQL — same column contract |
| API | `server.py` (`http.server`) | `api_fastapi.py` (`uvicorn`) — identical Section 10 contract |
| Scheduler | sleep-loop fallback (`scheduler.py`) | APScheduler cron (3×/day, FR-2) |
| Frontend | `frontend/` (vanilla + Tailwind CDN, no build) | Next.js + React + Tailwind |

The scoring engine, qualification gate, and query service are **pure and shared**
across both paths, so behavior is identical whichever way you run it.

---

## Quick start (zero dependencies)

```bash
cd backend
python3 seed.py                 # builds prime_day.db from synthetic data
python3 server.py               # API on http://localhost:8000
```

Then open the frontend (any static server, or just open the file):

```bash
cd ../frontend
python3 -m http.server 5173
# visit http://localhost:5173  (it calls the API at :8000 by default)
```

Point the UI at a different API with `?api=`, e.g.
`http://localhost:5173/?api=http://localhost:8000`.

## Run the tests (acceptance criteria AC-1..AC-8)

```bash
cd backend
python3 -m unittest discover -s tests -v
```

## Production data (Keepa)

```bash
cd backend
pip install -r requirements.txt
export KEEPA_API_KEY=...                       # paid Keepa key
python3 seed.py --source keepa --categories 172282 1055398   # Keepa node ids
uvicorn api_fastapi:app --port 8000
python3 scheduler.py                            # 3x-daily ingest (FR-2)
```

---

## API (PRD Section 10)

| Endpoint | Notes |
|---|---|
| `GET /api/deals` | `category, subcategory, price_min, price_max, min_discount, sort, page, page_size` — all optional & combinable. `sort ∈ {deal_score, discount, price_asc, price_desc}`, default `deal_score`. |
| `GET /api/deals/{asin}` | Single product, or `404` if not found / not qualified. |
| `GET /api/categories` | `category -> [subcategories]` map for the filter UI. |

## Scoring & gate at a glance

- **Qualification gate (hard filter):** ★ ≥ 4.0 · ≥ 1,000 reviews · price strictly
  below 90-day average · Bayesian rating ≥ peer median · return-rate not "High".
  Null review count fails the gate; snapshot counts qualify but are flagged.
- **Monica's Deal Score:** `0.40·DealStrength + 0.30·Exclusivity + 0.30·Quality`.
  All weights, thresholds, the Bayesian prior `m`, the reference-price baseline,
  peer grouping, and the display floor are configurable in `backend/config.py`
  (or via `PDE_*` env vars).

See `backend/README.md` for the file-by-file map and the PRD-requirement traceability.
