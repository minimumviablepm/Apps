"""
Monica's Deal Score — the scoring engine (PRD Section 9).

Pure, dependency-free functions so they are trivially unit-testable against the
Section 12 acceptance criteria. Each function maps 1:1 to a formula in the PRD.
"""
from __future__ import annotations

from typing import Optional

from config import CONFIG, Config


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


# --------------------------------------------------------------------------- #
# Pillar A — Deal Strength (PRD 9.1)
# --------------------------------------------------------------------------- #
def pillar_deal_strength(
    reference_price: float,
    current_price: float,
    all_time_low: float,
) -> float:
    """How good is this discount, really? (weight 40%)

        depth     = clamp((ref - cur) / ref, 0, 1)
        floor_gap = clamp(1 - (cur - atl) / ref, 0, 1)
        A         = 100 * (0.6 * depth + 0.4 * floor_gap)
    """
    if not reference_price or reference_price <= 0:
        return 0.0
    depth = clamp((reference_price - current_price) / reference_price)
    floor_gap = clamp(1 - (current_price - all_time_low) / reference_price)
    return 100.0 * (0.6 * depth + 0.4 * floor_gap)


# --------------------------------------------------------------------------- #
# Pillar B — Exclusivity / Scarcity (PRD 9.2)
# --------------------------------------------------------------------------- #
def pillar_exclusivity(
    exclusivity_pct: float,
    short_history: bool = False,
    cfg: Config = CONFIG,
) -> float:
    """Is this genuinely time-limited, or always on sale? (weight 30%)

        B = 100 * (1 - exclusivity_pct)

    `exclusivity_pct` is the fraction (0..1) of the trailing 365 days the price
    was at or below the current price. Products with < 365 days of history are
    capped (PRD Section 11) to avoid over-rewarding a missing baseline.
    """
    b = 100.0 * (1.0 - clamp(exclusivity_pct))
    if short_history:
        b = min(b, cfg.short_history_pillar_b_cap)
    return b


# --------------------------------------------------------------------------- #
# Pillar C — Quality & Peer Outperformance (PRD 9.3)
# --------------------------------------------------------------------------- #
def bayesian_rating(
    star_rating: float,
    review_count: int,
    category_mean: float,
    m: Optional[float] = None,
    cfg: Config = CONFIG,
) -> float:
    """Shrinkage-adjusted rating: pulls low-volume ratings toward category mean.

        bayes = (n / (n + m)) * star + (m / (n + m)) * C
    """
    if m is None:
        m = cfg.bayesian_prior_m
    n = max(0, review_count or 0)
    denom = n + m
    if denom <= 0:
        return star_rating
    return (n / denom) * star_rating + (m / denom) * category_mean


def pillar_quality(
    bayes_rating: float,
    peer_percentile: Optional[float],
    return_rate_flag: Optional[str],
    thin_peer_set: bool = False,
    cfg: Config = CONFIG,
) -> float:
    """Is this a good product, and better than its peers? (weight 30%)

        quality_norm   = clamp((bayes - 3.5) / (5.0 - 3.5), 0, 1)
        peer_norm      = peer_percentile / 100
        return_penalty = 0.5 if flag == 'High' else 1.0
        C = 100 * return_penalty * (0.5 * quality_norm + 0.5 * peer_norm)

    When the peer set is too thin (PRD Section 11), peer_percentile is None and
    the pillar uses quality_norm at 100% weight.
    """
    floor = cfg.quality_rating_floor
    quality_norm = clamp((bayes_rating - floor) / (5.0 - floor))
    return_penalty = cfg.return_penalty_high if return_rate_flag == "High" else 1.0

    if thin_peer_set or peer_percentile is None:
        blended = quality_norm
    else:
        peer_norm = clamp(peer_percentile / 100.0)
        blended = 0.5 * quality_norm + 0.5 * peer_norm

    return 100.0 * return_penalty * blended


# --------------------------------------------------------------------------- #
# Composite (PRD 9.4)
# --------------------------------------------------------------------------- #
def composite_score(
    pillar_a: float,
    pillar_b: float,
    pillar_c: float,
    cfg: Config = CONFIG,
) -> float:
    """deal_score = 0.40*A + 0.30*B + 0.30*C (weights configurable)."""
    return (
        cfg.weight_deal_strength * pillar_a
        + cfg.weight_exclusivity * pillar_b
        + cfg.weight_quality * pillar_c
    )


def composite_lite(pillar_a: float, pillar_b: float, cfg: Config = CONFIG) -> float:
    """Lite-mode composite from the two price pillars only (no ratings).

    Weights are renormalized so the score stays on a 0-100 scale even though
    Pillar C is absent.
    """
    wa, wb = cfg.weight_lite_deal_strength, cfg.weight_lite_exclusivity
    total = wa + wb or 1.0
    return (wa * pillar_a + wb * pillar_b) / total
