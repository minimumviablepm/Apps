"""
SQLite store implementing the PRD Section 8 data model.

SQLite (stdlib) is used so the engine runs with zero external dependencies.
The schema, column names, and indexes mirror the PRD; swapping to PostgreSQL is
a matter of pointing the DSN elsewhere and reusing the same column contract.
"""
from __future__ import annotations

import sqlite3
from typing import Iterable, List, Optional

from config import CONFIG, Config
from models import Product

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    asin                          TEXT PRIMARY KEY,
    title                         TEXT NOT NULL,
    image_url                     TEXT,
    category                      TEXT NOT NULL,
    subcategory                   TEXT NOT NULL,
    price_band                    TEXT,
    current_price                 REAL NOT NULL,
    avg_price_90d                 REAL,
    avg_price_180d                REAL,
    avg_price_365d                REAL,
    all_time_low                  REAL,
    reference_price               REAL,
    discount_pct                  REAL,
    star_rating                   REAL NOT NULL,
    review_count                  INTEGER,
    bayesian_rating               REAL,
    peer_percentile               REAL,
    return_rate_flag              TEXT,
    days_at_or_below_price_365d   INTEGER,
    exclusivity_pct               REAL,
    pillar_deal_strength          REAL,
    pillar_exclusivity            REAL,
    pillar_quality                REAL,
    deal_score                    REAL,
    qualified                     INTEGER NOT NULL,
    affiliate_url                 TEXT,
    camel_url                     TEXT,
    last_ingested_at              TEXT NOT NULL,
    review_count_stale            INTEGER DEFAULT 0,
    short_history                 INTEGER DEFAULT 0,
    thin_peer_set                 INTEGER DEFAULT 0,
    score_band                    TEXT
);
-- Indexes for filter/sort performance (PRD Section 13).
CREATE INDEX IF NOT EXISTS idx_deal_score   ON products(deal_score);
CREATE INDEX IF NOT EXISTS idx_discount_pct ON products(discount_pct);
CREATE INDEX IF NOT EXISTS idx_current_price ON products(current_price);
CREATE INDEX IF NOT EXISTS idx_category     ON products(category);
CREATE INDEX IF NOT EXISTS idx_subcategory  ON products(subcategory);
CREATE INDEX IF NOT EXISTS idx_qualified    ON products(qualified);
"""

# Columns persisted, in order. Keep in sync with SCHEMA.
COLUMNS = [
    "asin", "title", "image_url", "category", "subcategory", "price_band",
    "current_price", "avg_price_90d", "avg_price_180d", "avg_price_365d",
    "all_time_low", "reference_price", "discount_pct", "star_rating",
    "review_count", "bayesian_rating", "peer_percentile", "return_rate_flag",
    "days_at_or_below_price_365d", "exclusivity_pct", "pillar_deal_strength",
    "pillar_exclusivity", "pillar_quality", "deal_score", "qualified",
    "affiliate_url", "camel_url", "last_ingested_at", "review_count_stale",
    "short_history", "thin_peer_set", "score_band",
]


def connect(cfg: Config = CONFIG) -> sqlite3.Connection:
    conn = sqlite3.connect(cfg.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def connect_memory() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def _row_values(p: Product) -> tuple:
    d = p.to_dict()
    out = []
    for c in COLUMNS:
        v = d[c]
        if isinstance(v, bool):
            v = int(v)
        out.append(v)
    return tuple(out)


def upsert_products(conn: sqlite3.Connection, products: Iterable[Product]) -> int:
    placeholders = ", ".join("?" for _ in COLUMNS)
    cols = ", ".join(COLUMNS)
    sql = f"INSERT OR REPLACE INTO products ({cols}) VALUES ({placeholders})"
    rows = [_row_values(p) for p in products]
    conn.executemany(sql, rows)
    conn.commit()
    return len(rows)


def get_by_asin(conn: sqlite3.Connection, asin: str) -> Optional[sqlite3.Row]:
    cur = conn.execute("SELECT * FROM products WHERE asin = ?", (asin,))
    return cur.fetchone()


def distinct_categories(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT DISTINCT category, subcategory FROM products "
        "WHERE qualified = 1 ORDER BY category, subcategory"
    ).fetchall()
