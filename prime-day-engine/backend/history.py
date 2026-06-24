"""
Self-recording price history (for PA-API "lite" mode).

PA-API gives only the *current* price, so to power the history-based pillars
(Deal Strength's all-time low, Exclusivity's days-at-or-below) the engine records
every price reading here and derives the trailing-window statistics from its own
accumulated observations. The longer it runs, the richer the history.

Time is stored as unix epoch seconds so window math is trivial and tests can pass
a fixed `now`.
"""
from __future__ import annotations

import sqlite3
import time
from typing import Optional

DAY = 86400.0

HISTORY_SCHEMA = """
CREATE TABLE IF NOT EXISTS price_observations (
    asin        TEXT NOT NULL,
    price       REAL NOT NULL,
    observed_at REAL NOT NULL          -- unix epoch seconds
);
CREATE INDEX IF NOT EXISTS idx_obs_asin ON price_observations(asin);
CREATE INDEX IF NOT EXISTS idx_obs_time ON price_observations(observed_at);
"""


def init_history(conn: sqlite3.Connection) -> None:
    conn.executescript(HISTORY_SCHEMA)
    conn.commit()


def record(conn: sqlite3.Connection, asin: str, price: float, observed_at: Optional[float] = None) -> None:
    if price is None or price <= 0:
        return
    if observed_at is None:
        observed_at = time.time()
    conn.execute(
        "INSERT INTO price_observations (asin, price, observed_at) VALUES (?, ?, ?)",
        (asin, float(price), float(observed_at)),
    )


def _avg_in_window(rows, now: float, days: float) -> Optional[float]:
    cutoff = now - days * DAY
    vals = [p for (p, t) in rows if t >= cutoff]
    return round(sum(vals) / len(vals), 2) if vals else None


def derive_stats(conn: sqlite3.Connection, asin: str, current_price: float, now: Optional[float] = None) -> dict:
    """Compute trailing-window stats for an ASIN from its recorded observations.

    Returns the same fields the Keepa source would supply, so the rest of the
    pipeline is identical:
        avg_price_90d / 180d / 365d, all_time_low,
        days_at_or_below_price_365d, price_history_days.
    """
    if now is None:
        now = time.time()
    rows = conn.execute(
        "SELECT price, observed_at FROM price_observations "
        "WHERE asin = ? AND observed_at >= ? ORDER BY observed_at ASC",
        (asin, now - 365 * DAY),
    ).fetchall()
    rows = [(r[0], r[1]) for r in rows]

    if not rows:
        # First-ever reading: only the current price is known.
        return {
            "avg_price_90d": current_price,
            "avg_price_180d": current_price,
            "avg_price_365d": current_price,
            "all_time_low": current_price,
            "days_at_or_below_price_365d": 1,
            "price_history_days": 1,
        }

    avg90 = _avg_in_window(rows, now, 90)
    avg180 = _avg_in_window(rows, now, 180)
    avg365 = _avg_in_window(rows, now, 365)
    all_time_low = round(min(p for p, _ in rows), 2)

    # Days (calendar buckets) on which the recorded price was <= current price.
    by_day = {}
    for p, t in rows:
        d = int(t // DAY)
        by_day[d] = min(by_day.get(d, p), p)
    days_at_or_below = sum(1 for v in by_day.values() if v <= current_price)

    earliest = min(t for _, t in rows)
    history_days = max(1, min(365, int((now - earliest) / DAY) + 1))

    return {
        "avg_price_90d": avg90,
        "avg_price_180d": avg180,
        "avg_price_365d": avg365,
        "all_time_low": all_time_low,
        "days_at_or_below_price_365d": days_at_or_below,
        "price_history_days": history_days,
    }
