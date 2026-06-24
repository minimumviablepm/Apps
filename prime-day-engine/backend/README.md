# Backend — Prime Day Deal Engine

Pure-Python core (no third-party deps required). Production adapters (Keepa,
FastAPI, APScheduler) are import-guarded and listed in `requirements.txt`.

## File map & PRD traceability

| File | Responsibility | PRD |
|---|---|---|
| `config.py` | All tunables: gate thresholds, pillar weights, Bayesian `m`, reference-price baseline, peer grouping, display floor, affiliate tag, score bands. | §7.2, §9, §13, OQ-4/5/6, FR-18 |
| `models.py` | `RawProduct` (source output) and `Product` (derived/scored record). | §8 |
| `deal_score.py` | Pure scoring functions: Pillar A/B/C, Bayesian rating, composite. | §9 |
| `peers.py` | Peer grouping, price bands, Bayesian rating, peer percentile. | §9.3, FR-7, §11 |
| `qualification.py` | The hard qualification gate + edge-case flags. | §7.2, §11 |
| `pipeline.py` | ingest → derive → peer-rank → qualify → score → persist. | §7.1–7.3, §11 |
| `db.py` | SQLite schema mirroring §8 + filter/sort indexes. | §8, §13 |
| `service.py` | Filter / sort / paginate query layer behind the API. | §7.4, §10 |
| `server.py` | Zero-dependency `http.server` API. | §10 |
| `api_fastapi.py` | FastAPI API (same `service.py`, same contract). | §10, §13 |
| `ingestion/mock_source.py` | Deterministic synthetic data for offline runs. | §4 |
| `ingestion/keepa_source.py` | Real Keepa adapter (discovery + enrichment). | §4, FR-1/3 |
| `ingestion/paapi_source.py` | Free Amazon PA-API adapter (lite mode). | §4 |
| `history.py` | Self-recording price history for lite mode (builds averages / all-time low / exclusivity from accumulated readings). | §4 |
| `scheduler.py` | 3×-daily ingest cadence (APScheduler or sleep fallback). | FR-2 |
| `seed.py` | CLI to (re)build the store from mock or Keepa. | §7.1 |
| `tests/` | `test_acceptance.py` (AC-1..AC-8), `test_scoring.py` (formulas + edge cases), `test_lite_mode.py` (PA-API self-recording + price-only scoring). | §12, §11 |

### Data sources

| Source | `--source` / `PDE_INGEST_SOURCE` | Cost | Needs |
|---|---|---|---|
| Mock | `mock` (default) | free | nothing |
| Keepa | `keepa` | ~€49/mo | `KEEPA_API_KEY` |
| PA-API lite | `paapi` (+ `PDE_LITE_MODE=1`) | free | Associates approval; price history builds over time |

## Configuration (env vars)

All optional; defaults match the PRD. Examples:

```bash
export PDE_W_A=0.4 PDE_W_B=0.3 PDE_W_C=0.3   # pillar weights (OQ-6)
export PDE_BAYES_M=500                        # Bayesian prior strength (OQ-6)
export PDE_REFERENCE=avg_price_90d            # reference-price baseline (OQ-5)
export PDE_PEER_GROUPING=subcategory+price_band  # peer set rule (OQ-4)
export PDE_DISPLAY_FLOOR=60                    # hide curated items below this score
export PDE_AFFILIATE_TAG=monicadeals-20       # Associate tag (FR-18)
export PDE_DB_PATH=prime_day.db
```

## Notes on known constraints (PRD §4 / §11)

- **Keepa review-count freshness:** counts are treated as a possibly-stale
  snapshot. Null → fails the ≥1,000 gate; a snapshot value qualifies but sets
  `review_count_stale=true` so the UI can show a soft disclaimer.
- **Short price history:** exclusivity is computed over the available window and
  Pillar B is capped at 70; `short_history=true`.
- **Thin peer set (< 10):** the peer-percentile gate is skipped, `peer_percentile`
  is null, Pillar C falls back to quality-only; `thin_peer_set=true`.
- **Partial/interrupted ingest:** `pipeline.run()` upserts, so a later run resumes
  without wiping previously scored data.
