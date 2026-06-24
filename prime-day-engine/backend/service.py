"""
Query service backing the Section 10 API contract.

Framework-agnostic: every function takes a sqlite3 connection so it can be
driven by the stdlib server, the FastAPI app, or the unit tests identically.
"""
from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional

from config import CONFIG, Config

SORTS = {
    "deal_score": "deal_score DESC",
    "discount": "discount_pct DESC",
    "price_asc": "current_price ASC",
    "price_desc": "current_price DESC",
}
DEFAULT_SORT = "deal_score"
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def _clean_row(row: sqlite3.Row, cfg: Config) -> Dict[str, Any]:
    d = dict(row)
    # SQLite stores booleans as ints; restore them for the JSON payload.
    for b in ("qualified", "review_count_stale", "short_history", "thin_peer_set"):
        if b in d and d[b] is not None:
            d[b] = bool(d[b])
    return d


def query_deals(
    conn: sqlite3.Connection,
    *,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    min_discount: Optional[float] = None,
    sort: str = DEFAULT_SORT,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    cfg: Config = CONFIG,
) -> Dict[str, Any]:
    """Filtered, sorted, paginated list of curated deals (PRD FR-11..16)."""
    if sort not in SORTS:
        sort = DEFAULT_SORT
    page = max(1, int(page or 1))
    page_size = min(MAX_PAGE_SIZE, max(1, int(page_size or DEFAULT_PAGE_SIZE)))

    # Curated list = passed the gate AND above the display score floor.
    where = ["qualified = 1", "deal_score >= ?"]
    params: List[Any] = [cfg.display_score_floor]

    if category:
        where.append("category = ?"); params.append(category)
    if subcategory:
        where.append("subcategory = ?"); params.append(subcategory)
    if price_min is not None:
        where.append("current_price >= ?"); params.append(float(price_min))
    if price_max is not None:
        where.append("current_price <= ?"); params.append(float(price_max))
    if min_discount is not None:
        where.append("discount_pct >= ?"); params.append(float(min_discount))

    where_sql = " AND ".join(where)

    total = conn.execute(
        f"SELECT COUNT(*) AS n FROM products WHERE {where_sql}", params
    ).fetchone()["n"]

    offset = (page - 1) * page_size
    # Tie-break by asin for stable pagination ordering.
    rows = conn.execute(
        f"SELECT * FROM products WHERE {where_sql} "
        f"ORDER BY {SORTS[sort]}, asin ASC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    ).fetchall()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "sort": sort,
        "results": [_clean_row(r, cfg) for r in rows],
    }


def get_deal(conn: sqlite3.Connection, asin: str, cfg: Config = CONFIG) -> Optional[Dict[str, Any]]:
    """Single product, or None if not found / not qualified (PRD Section 10)."""
    row = conn.execute(
        "SELECT * FROM products WHERE asin = ? AND qualified = 1", (asin,)
    ).fetchone()
    return _clean_row(row, cfg) if row else None


def get_categories(conn: sqlite3.Connection) -> Dict[str, List[str]]:
    """category -> [subcategories] map for the filter UI (PRD Section 10)."""
    rows = conn.execute(
        "SELECT DISTINCT category, subcategory FROM products "
        "WHERE qualified = 1 AND deal_score >= ? ORDER BY category, subcategory",
        (CONFIG.display_score_floor,),
    ).fetchall()
    out: Dict[str, List[str]] = {}
    for r in rows:
        out.setdefault(r["category"], []).append(r["subcategory"])
    return out
