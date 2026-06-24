"""
Amazon Product Advertising API (PA-API 5.0) data source — the free "lite" mode.

Why this exists: a no-cost alternative to a paid Keepa subscription. PA-API is
Amazon's *official* API, so it's allowed (unlike scraping). Trade-offs you must
know (and which the engine handles):

  - PA-API returns the CURRENT price + product metadata, but NO price history.
    So this source RECORDS each price reading into `history.py` and DERIVES the
    trailing-window stats (averages, all-time low, exclusivity) from the engine's
    own accumulated observations. It is weak on day one and improves over time.
  - PA-API does NOT return numeric star ratings / review counts. So this source
    leaves them empty and the engine runs in lite mode (PDE_LITE_MODE=1): the
    quality gate and Pillar C are skipped; scoring uses the two price pillars.

Requirements:
  - An Amazon Associates account approved for PA-API (needs 3 qualifying sales
    in 180 days). Then set:
        PAAPI_ACCESS_KEY, PAAPI_SECRET_KEY, PAAPI_PARTNER_TAG
        PAAPI_COUNTRY (default "US")
  - `pip install python-amazon-paapi`
  - Provide ASINs to track via PDE_PAAPI_ASINS (comma-separated) and/or keywords
    to discover them via PDE_PAAPI_KEYWORDS (comma-separated). PA-API has no
    Keepa-style Product Finder, so discovery is keyword search + your watchlist.

Run cadence is the same scheduler as Keepa; each run appends one observation per
ASIN, building history.
"""
from __future__ import annotations

import os
import time
from typing import List, Optional

import db
import history
from config import CONFIG
from models import RawProduct

_CHUNK = 10  # PA-API GetItems accepts up to 10 ASINs per request


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


class PaapiSource:
    def __init__(
        self,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        partner_tag: Optional[str] = None,
        country: Optional[str] = None,
    ):
        self.access_key = access_key or os.environ.get("PAAPI_ACCESS_KEY")
        self.secret_key = secret_key or os.environ.get("PAAPI_SECRET_KEY")
        self.partner_tag = partner_tag or os.environ.get("PAAPI_PARTNER_TAG")
        self.country = country or os.environ.get("PAAPI_COUNTRY", "US")
        if not all([self.access_key, self.secret_key, self.partner_tag]):
            raise RuntimeError(
                "PA-API credentials missing. Set PAAPI_ACCESS_KEY, "
                "PAAPI_SECRET_KEY, PAAPI_PARTNER_TAG."
            )
        try:
            from amazon_paapi import AmazonApi  # type: ignore
        except ImportError as e:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "python-amazon-paapi not installed. `pip install python-amazon-paapi`."
            ) from e
        self.api = AmazonApi(
            self.access_key, self.secret_key, self.partner_tag, self.country
        )

    # ---- discovery: explicit watchlist + optional keyword search ---------- #
    def _watchlist_asins(self) -> List[str]:
        raw = os.environ.get("PDE_PAAPI_ASINS", "")
        return [a.strip() for a in raw.split(",") if a.strip()]

    def _discover_by_keywords(self) -> List[str]:
        kw = os.environ.get("PDE_PAAPI_KEYWORDS", "")
        keywords = [k.strip() for k in kw.split(",") if k.strip()]
        found: List[str] = []
        for term in keywords:
            try:
                res = self.api.search_items(keywords=term, item_count=10)
                for it in getattr(res, "items", []) or []:
                    if it.asin:
                        found.append(it.asin)
                time.sleep(1)  # PA-API throttles ~1 req/s
            except Exception as e:  # keep discovery resilient
                print(f"[paapi] keyword '{term}' search failed: {e}")
        return found

    # ---- main entry point -------------------------------------------------- #
    def fetch(self, categories: Optional[List[str]] = None) -> List[RawProduct]:
        asins = self._watchlist_asins() + self._discover_by_keywords()
        # de-dupe, preserve order
        seen = set()
        asins = [a for a in asins if not (a in seen or seen.add(a))]
        if not asins:
            print("[paapi] no ASINs to track — set PDE_PAAPI_ASINS or PDE_PAAPI_KEYWORDS")
            return []

        conn = db.connect(CONFIG)
        history.init_history(conn)
        now = time.time()
        raws: List[RawProduct] = []

        for batch in _chunks(asins, _CHUNK):
            try:
                items = self.api.get_items(batch)
            except Exception as e:
                print(f"[paapi] get_items failed for {batch}: {e}")
                continue
            for it in items or []:
                raw = self._to_raw(conn, it, now)
                if raw:
                    raws.append(raw)
            time.sleep(1)

        conn.commit()
        conn.close()
        return raws

    # ---- mapping ----------------------------------------------------------- #
    def _to_raw(self, conn, item, now: float) -> Optional[RawProduct]:
        asin = getattr(item, "asin", None)
        if not asin:
            return None
        price = self._price(item)
        if price is None:
            return None

        # Record this reading, then derive trailing stats from accumulated history.
        history.record(conn, asin, price, now)
        stats = history.derive_stats(conn, asin, price, now)

        title = self._title(item) or asin
        image = self._image(item)
        category, subcategory = self._categories(item)

        return RawProduct(
            asin=asin,
            title=title,
            image_url=image,
            category=category,
            subcategory=subcategory,
            current_price=price,
            avg_price_90d=stats["avg_price_90d"],
            avg_price_180d=stats["avg_price_180d"],
            avg_price_365d=stats["avg_price_365d"],
            all_time_low=stats["all_time_low"],
            star_rating=0.0,        # PA-API does not expose numeric ratings
            review_count=None,      # -> engine runs in lite mode
            sales_rank=None,
            return_rate_flag=None,
            days_at_or_below_price_365d=stats["days_at_or_below_price_365d"],
            price_history_days=stats["price_history_days"],
            review_count_is_snapshot=False,
        )

    @staticmethod
    def _price(item) -> Optional[float]:
        try:
            listing = item.offers.listings[0]
            amount = listing.price.amount
            return round(float(amount), 2) if amount else None
        except (AttributeError, IndexError, TypeError):
            return None

    @staticmethod
    def _title(item) -> Optional[str]:
        try:
            return item.item_info.title.display_value
        except AttributeError:
            return None

    @staticmethod
    def _image(item) -> Optional[str]:
        try:
            return item.images.primary.large.url
        except AttributeError:
            return None

    @staticmethod
    def _categories(item):
        try:
            nodes = item.browse_node_info.browse_nodes or []
            if nodes:
                names = [n.display_name for n in nodes if getattr(n, "display_name", None)]
                if names:
                    return names[0], names[-1]
        except AttributeError:
            pass
        return "Amazon", "Amazon"
