"""
Qualification gate (PRD Section 7.2) + edge-case handling (PRD Section 11).

A product must pass ALL criteria to enter the curated list. Returns a structured
result so callers know exactly why something was excluded (FR-10, diagnostics).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from config import CONFIG, Config
from models import RawProduct


@dataclass
class GateResult:
    qualified: bool
    reasons: List[str] = field(default_factory=list)   # why it failed
    review_count_stale: bool = False
    short_history: bool = False
    thin_peer_set: bool = False


def reference_price(raw: RawProduct, cfg: Config = CONFIG) -> Optional[float]:
    """The baseline used for the discount headline (PRD OQ-5, configurable)."""
    return getattr(raw, cfg.reference_price_field, None)


def qualify(
    raw: RawProduct,
    peer_percentile: Optional[float],
    thin_peer_set: bool,
    cfg: Config = CONFIG,
) -> GateResult:
    reasons: List[str] = []

    short_history = raw.price_history_days < 365

    # FR-5 review-count handling first (PRD Section 4 / 11 caveat).
    # Null/unknown count => fail (never assume qualification).
    review_count_stale = False
    if raw.review_count is None:
        reasons.append("review_count_unknown")
    else:
        if raw.review_count_is_snapshot:
            review_count_stale = True  # qualify on it but flag for a soft UI note
        if raw.review_count < cfg.min_review_count:
            reasons.append(f"review_count<{cfg.min_review_count}")

    # FR-4 star rating
    if raw.star_rating < cfg.min_star_rating:
        reasons.append(f"star_rating<{cfg.min_star_rating}")

    # FR-6 real discount: current strictly below the trailing-90d reference.
    ref90 = raw.avg_price_90d
    if ref90 is None or not (raw.current_price < ref90):
        reasons.append("no_real_discount")

    # FR-8 return-rate flag must not be High
    if raw.return_rate_flag == "High":
        reasons.append("return_rate_high")

    # FR-7 peer outperformance — skipped for thin peer sets (PRD Section 11).
    if not thin_peer_set:
        if peer_percentile is None or peer_percentile < cfg.peer_percentile_floor:
            reasons.append(f"peer_percentile<{cfg.peer_percentile_floor}")

    return GateResult(
        qualified=len(reasons) == 0,
        reasons=reasons,
        review_count_stale=review_count_stale,
        short_history=short_history,
        thin_peer_set=thin_peer_set,
    )
