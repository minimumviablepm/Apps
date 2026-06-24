"""
Keepa data source (PRD Section 4 — primary data backbone).

This is the production adapter. It is import-guarded: the `keepa` package and a
paid API key are only needed when you actually run it. The rest of the engine
(scoring, gate, API, tests) runs without it via MockSource.

Usage:
    export KEEPA_API_KEY=...
    source = KeepaSource()
    raws = source.fetch(["Electronics"])

Keepa specifics handled here:
  - Product Finder per category node to discover candidate ASINs (FR-1), up to
    10,000 ASINs per filtered query.
  - `stats` block for 30/90/180/365-day averages and all-time low (FR-3).
  - Rating is in 0..50 integer tenths -> divide by 10 for 0..5 stars.
  - review_count is treated as a possibly-stale snapshot (PRD Section 4), so it
    is flagged accordingly and passed through; the gate decides.
  - exclusivity is derived from the price-history time series: the share of the
    trailing 365 days the price was <= the current price.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional

from models import RawProduct

KEEPA_CENTS = 100.0  # Keepa returns prices in cents
MINUTES_PER_DAY = 1440


class KeepaSource:
    def __init__(self, api_key: Optional[str] = None, domain: str = "US"):
        self.api_key = api_key or os.environ.get("KEEPA_API_KEY")
        if not self.api_key:
            raise RuntimeError(
                "KEEPA_API_KEY not set. Set it, or use MockSource for offline runs."
            )
        try:
            import keepa  # noqa: F401  (import-guarded; only needed at runtime)
        except ImportError as e:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "The 'keepa' package is not installed. `pip install keepa`."
            ) from e
        self._keepa = keepa
        self.api = keepa.Keepa(self.api_key)
        self.domain = domain

    # ---- discovery (FR-1) -------------------------------------------------- #
    def find_asins(self, category_node: int, limit: int = 10000) -> List[str]:
        """Keepa Product Finder for a category node within the event window."""
        query = {
            "categories_include": [category_node],
            "current_SALES_gte": 0,          # in stock / ranked
            "current_COUNT_REVIEWS_gte": 1000,  # pre-filter near the FR-5 gate
            "perPage": limit,
        }
        return self.api.product_finder(query, domain=self.domain)

    # ---- enrichment (FR-3) ------------------------------------------------- #
    def fetch_asins(self, asins: List[str]) -> List[RawProduct]:
        products = self.api.query(
            asins, domain=self.domain, stats=365, rating=True, history=True
        )
        return [self._to_raw(p) for p in products if p]

    def fetch(self, categories: Optional[List[str]] = None) -> List[RawProduct]:
        """Discover + enrich for the given category nodes.

        `categories` here are Keepa numeric category node ids (as strings).
        Map your human category names to node ids in your deployment config.
        """
        nodes = [int(c) for c in (categories or [])]
        all_asins: List[str] = []
        for node in nodes:
            all_asins.extend(self.find_asins(node))
        # de-dupe preserving order
        seen = set()
        uniq = [a for a in all_asins if not (a in seen or seen.add(a))]
        return self.fetch_asins(uniq)

    # ---- mapping ----------------------------------------------------------- #
    def _to_raw(self, p: Dict) -> RawProduct:
        stats = p.get("stats", {}) or {}

        def price(key) -> Optional[float]:
            v = stats.get(key)
            if isinstance(v, (list, tuple)):
                v = v[0] if v else None  # [amazon, new, used,...] -> amazon/new
            if v is None or v < 0:
                return None
            return round(v / KEEPA_CENTS, 2)

        current = price("current")
        avg90 = price("avg90")
        avg180 = price("avg180")
        avg365 = price("avg365")
        atl = price("atl")

        rating_raw = stats.get("rating")
        star = round((rating_raw or 0) / 10.0, 1) if rating_raw else 0.0
        reviews = stats.get("reviewCount") or stats.get("count_reviews")

        cats = p.get("categoryTree") or []
        category = cats[0]["name"] if cats else (p.get("rootCategory") and str(p["rootCategory"])) or "Unknown"
        subcategory = cats[-1]["name"] if cats else category

        exclusivity_days = self._days_at_or_below(p, current)

        return RawProduct(
            asin=p.get("asin"),
            title=p.get("title") or p.get("asin"),
            image_url=self._image(p),
            category=category,
            subcategory=subcategory,
            current_price=current if current is not None else 0.0,
            avg_price_90d=avg90,
            avg_price_180d=avg180,
            avg_price_365d=avg365,
            all_time_low=atl,
            star_rating=star,
            review_count=reviews,
            sales_rank=(stats.get("current") if False else p.get("salesRanks") and None) or None,
            return_rate_flag="High" if p.get("isHighReturnRate") else "Low",
            days_at_or_below_price_365d=exclusivity_days,
            price_history_days=self._history_days(p),
            # Keepa rating-count history was frozen in 2025: treat as a snapshot.
            review_count_is_snapshot=True,
        )

    @staticmethod
    def _image(p: Dict) -> Optional[str]:
        imgs = p.get("imagesCSV")
        if imgs:
            first = imgs.split(",")[0]
            return f"https://m.media-amazon.com/images/I/{first}"
        return None

    @staticmethod
    def _history_days(p: Dict) -> int:
        data = (p.get("data") or {})
        series = data.get("AMAZON_time") or data.get("NEW_time")
        if not series:
            return 365
        span_minutes = series[-1] - series[0]
        return min(365, max(1, int(span_minutes / MINUTES_PER_DAY)))

    @staticmethod
    def _days_at_or_below(p: Dict, current: Optional[float]) -> Optional[int]:
        """Count days in the trailing year the price was <= current price.

        Uses the parsed AMAZON/NEW price+time series from `keepa` (history=True).
        Falls back to None when unavailable (pipeline then uses a default).
        """
        if current is None:
            return None
        data = (p.get("data") or {})
        prices = data.get("AMAZON") or data.get("NEW")
        times = data.get("AMAZON_time") or data.get("NEW_time")
        if prices is None or times is None or len(prices) != len(times):
            return None
        # Walk the step-function series, summing day spans priced <= current.
        days = 0.0
        for i in range(len(prices) - 1):
            pr = prices[i]
            if pr is None or pr < 0:
                continue
            if pr <= current:
                days += (times[i + 1] - times[i]) / MINUTES_PER_DAY
        return int(round(days))
