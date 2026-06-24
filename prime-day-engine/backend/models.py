"""
Data models for the Prime Day Deal Engine.

`RawProduct`  - what an ingestion DataSource yields (raw facts about an ASIN).
`Product`     - a fully derived, gated and scored record matching the PRD
                Section 8 data model. This is what the store persists and the
                API returns.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class RawProduct:
    """Raw facts about an ASIN as returned by a data source (Keepa / mock).

    `review_count` is intentionally Optional: per PRD Section 4, Keepa's
    rating-count history was frozen in 2025 and may be a stale snapshot or
    missing entirely. `None` means "unknown" and must fail the gate (FR-5).
    """
    asin: str
    title: str
    image_url: Optional[str]
    category: str
    subcategory: str
    current_price: float
    avg_price_90d: Optional[float]
    avg_price_180d: Optional[float]
    avg_price_365d: Optional[float]
    all_time_low: Optional[float]
    star_rating: float
    review_count: Optional[int]
    sales_rank: Optional[int]
    return_rate_flag: Optional[str]                 # 'Low' | 'High' | None
    days_at_or_below_price_365d: Optional[int]      # for exclusivity math
    price_history_days: int = 365                   # actual window available
    review_count_is_snapshot: bool = False          # PRD Section 4 / 11


@dataclass
class Product:
    """Derived, gated and scored record (PRD Section 8)."""
    asin: str
    title: str
    image_url: Optional[str]
    category: str
    subcategory: str
    price_band: Optional[str]
    current_price: float
    avg_price_90d: Optional[float]
    avg_price_180d: Optional[float]
    avg_price_365d: Optional[float]
    all_time_low: Optional[float]
    reference_price: Optional[float]
    discount_pct: Optional[float]
    star_rating: float
    review_count: Optional[int]
    bayesian_rating: Optional[float]
    peer_percentile: Optional[float]
    return_rate_flag: Optional[str]
    days_at_or_below_price_365d: Optional[int]
    exclusivity_pct: Optional[float]
    pillar_deal_strength: Optional[float]
    pillar_exclusivity: Optional[float]
    pillar_quality: Optional[float]
    deal_score: Optional[float]
    qualified: bool
    affiliate_url: str
    camel_url: str
    last_ingested_at: str
    # Soft flags surfaced to the UI (PRD Section 11)
    review_count_stale: bool = False
    short_history: bool = False
    thin_peer_set: bool = False
    score_band: Optional[str] = None
    # Diagnostics (why it failed the gate); not persisted to the SQL columns
    disqualified_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)
