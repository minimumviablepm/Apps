"""
Offline synthetic data source.

Generates realistic Prime Day candidate ASINs — deterministically (seeded) so
runs and tests are reproducible — with a deliberate mix of:
  - genuine deals (deep discount, near all-time-low, well reviewed, rare price)
  - fake discounts (current price == 90d average)         -> excluded by FR-6
  - low-quality items (< 4.0 stars)                        -> excluded by FR-4
  - thinly reviewed items (< 1,000 reviews)                -> excluded by FR-5
  - perennial sales (price at this level most of the year) -> low Pillar B
  - high return-rate items                                 -> excluded by FR-8

This lets the engine demonstrate the qualification gate without a Keepa key.
"""
from __future__ import annotations

import random
from typing import List, Optional

from models import RawProduct

CATALOG = {
    "Electronics": ["Headphones", "Smart Home", "Tablets", "Chargers", "Cameras"],
    "Home & Kitchen": ["Coffee", "Cookware", "Vacuums", "Air Fryers", "Bedding"],
    "Beauty": ["Skincare", "Hair Tools", "Fragrance", "Makeup"],
    "Toys & Games": ["Building Sets", "Board Games", "Outdoor", "Plush"],
    "Sports & Outdoors": ["Fitness", "Camping", "Cycling", "Hydration"],
}

_ADJ = ["Pro", "Max", "Ultra", "Lite", "Plus", "Air", "Elite", "Mini", "X", "Go"]
_NOUN = {
    "Headphones": "ANC Headphones", "Smart Home": "Smart Plug", "Tablets": "Tablet",
    "Chargers": "GaN Charger", "Cameras": "Action Cam", "Coffee": "Espresso Maker",
    "Cookware": "Nonstick Set", "Vacuums": "Robot Vacuum", "Air Fryers": "Air Fryer",
    "Bedding": "Cooling Sheets", "Skincare": "Vitamin C Serum", "Hair Tools": "Hair Dryer",
    "Fragrance": "Eau de Parfum", "Makeup": "Setting Spray", "Building Sets": "Brick Set",
    "Board Games": "Strategy Game", "Outdoor": "Water Blaster", "Plush": "Plush Bear",
    "Fitness": "Adjustable Dumbbell", "Camping": "Camp Stove", "Cycling": "Bike Light",
    "Hydration": "Insulated Bottle",
}


def _asin(i: int) -> str:
    base = "B0"
    s = f"{i:08d}"
    return base + s[:8]


class MockSource:
    """Deterministic synthetic DataSource."""

    def __init__(self, n_per_subcategory: int = 120, seed: int = 20260623):
        self.n_per_subcategory = n_per_subcategory
        self.seed = seed

    def fetch(self, categories: Optional[List[str]] = None) -> List[RawProduct]:
        rng = random.Random(self.seed)
        cats = categories or list(CATALOG.keys())
        out: List[RawProduct] = []
        counter = 1

        for cat in cats:
            for sub in CATALOG[cat]:
                for _ in range(self.n_per_subcategory):
                    out.append(self._make(rng, cat, sub, counter))
                    counter += 1
        return out

    def _make(self, rng: random.Random, cat: str, sub: str, i: int) -> RawProduct:
        kind = rng.choices(
            ["genuine", "fake_discount", "low_rating", "thin_reviews",
             "perennial", "high_returns", "new_product"],
            weights=[46, 12, 12, 12, 8, 6, 4],
        )[0]

        # Baseline "normal" price the product usually sells at.
        base = round(rng.uniform(15, 900), 2)
        avg90 = base
        avg180 = round(base * rng.uniform(0.98, 1.05), 2)
        avg365 = round(base * rng.uniform(0.98, 1.08), 2)
        all_time_low = round(base * rng.uniform(0.55, 0.9), 2)

        star = round(rng.uniform(4.0, 4.9), 1)
        reviews = rng.randint(1000, 90000)
        return_flag = "Low"
        history_days = 365
        snapshot = rng.random() < 0.15  # some sources mark counts as snapshots

        # Default: a genuine discount somewhere between all-time-low and avg90.
        current = round(rng.uniform(all_time_low, avg90 * 0.92), 2)
        days_at_or_below = rng.randint(2, 40)

        if kind == "fake_discount":
            current = avg90                      # no real discount -> FR-6
            days_at_or_below = rng.randint(100, 300)
        elif kind == "low_rating":
            star = round(rng.uniform(2.8, 3.9), 1)   # FR-4
        elif kind == "thin_reviews":
            reviews = rng.randint(5, 999)            # FR-5
        elif kind == "perennial":
            current = round(all_time_low * rng.uniform(1.0, 1.05), 2)
            days_at_or_below = rng.randint(200, 360)  # always on sale -> low Pillar B
        elif kind == "high_returns":
            return_flag = "High"                     # FR-8
        elif kind == "new_product":
            history_days = rng.randint(30, 200)       # short history
            days_at_or_below = rng.randint(1, 10)

        # Occasionally a null review count (PRD Section 4/11): must fail the gate.
        review_count: Optional[int] = reviews
        if rng.random() < 0.03:
            review_count = None

        name = f"{sub.split()[0]} {rng.choice(_ADJ)} {_NOUN[sub]}"

        return RawProduct(
            asin=_asin(i),
            title=name,
            image_url=f"https://picsum.photos/seed/{_asin(i)}/240/240",
            category=cat,
            subcategory=sub,
            current_price=current,
            avg_price_90d=avg90,
            avg_price_180d=avg180,
            avg_price_365d=avg365,
            all_time_low=min(all_time_low, current),
            star_rating=star,
            review_count=review_count,
            sales_rank=rng.randint(1, 50000),
            return_rate_flag=return_flag,
            days_at_or_below_price_365d=days_at_or_below,
            price_history_days=history_days,
            review_count_is_snapshot=snapshot,
        )
