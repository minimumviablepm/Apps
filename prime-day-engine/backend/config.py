"""
Central configuration for the Prime Day Deal Engine.

Everything tunable lives here so the scoring weights, gate thresholds, and
monetization settings can be changed without touching logic (PRD OQ-6, FR-7,
FR-18). Values can be overridden via environment variables for deployment.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return default


def _i(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


@dataclass(frozen=True)
class Config:
    # ---- Qualification gate (PRD 7.2) ----
    min_star_rating: float = _f("PDE_MIN_STAR", 4.0)            # FR-4
    min_review_count: int = _i("PDE_MIN_REVIEWS", 1000)         # FR-5
    peer_percentile_floor: float = _f("PDE_PEER_FLOOR", 50.0)   # FR-7

    # ---- Reference price for the discount headline (PRD OQ-5) ----
    # one of: avg_price_90d | avg_price_180d | avg_price_365d
    reference_price_field: str = os.environ.get("PDE_REFERENCE", "avg_price_90d")

    # ---- Peer grouping (PRD OQ-4) ----
    # "subcategory" or "subcategory+price_band"
    peer_grouping: str = os.environ.get("PDE_PEER_GROUPING", "subcategory+price_band")
    min_peer_set: int = _i("PDE_MIN_PEER_SET", 10)             # PRD Section 11

    # ---- Scoring engine (PRD Section 9) ----
    weight_deal_strength: float = _f("PDE_W_A", 0.40)          # Pillar A
    weight_exclusivity: float = _f("PDE_W_B", 0.30)           # Pillar B
    weight_quality: float = _f("PDE_W_C", 0.30)              # Pillar C

    bayesian_prior_m: float = _f("PDE_BAYES_M", 500.0)        # shrinkage strength
    quality_rating_floor: float = _f("PDE_QUALITY_FLOOR", 3.5)
    return_penalty_high: float = _f("PDE_RETURN_PENALTY", 0.5)
    short_history_pillar_b_cap: float = _f("PDE_SHORT_HISTORY_CAP", 70.0)

    # ---- Curated-list display floor (PRD Section 9.4) ----
    # Qualified products below this composite score are hidden from the curated
    # list (configurable; set to 0 to show everything that passed the gate).
    display_score_floor: float = _f("PDE_DISPLAY_FLOOR", 60.0)

    # ---- Score bands for UI labels (PRD Section 9.4) ----
    score_bands: Dict[str, float] = field(
        default_factory=lambda: {"Elite": 90.0, "Strong": 75.0, "Solid": 60.0}
    )

    # ---- Monetization (PRD FR-18) ----
    affiliate_tag: str = os.environ.get("PDE_AFFILIATE_TAG", "monicadeals-20")
    amazon_domain: str = os.environ.get("PDE_AMAZON_DOMAIN", "www.amazon.com")

    # ---- Storage ----
    db_path: str = os.environ.get("PDE_DB_PATH", "prime_day.db")


CONFIG = Config()


def band_for(score: float, cfg: Config = CONFIG) -> str:
    """Map a composite score to a UI band label (PRD Section 9.4)."""
    if score >= cfg.score_bands["Elite"]:
        return "Elite"
    if score >= cfg.score_bands["Strong"]:
        return "Strong"
    if score >= cfg.score_bands["Solid"]:
        return "Solid"
    return "Below floor"
