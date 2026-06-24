"""
Peer-set math (PRD FR-7, Section 9.3, Section 11).

Given the full candidate set, assign each product:
  - category_mean   : mean star rating of its peer group (the Bayesian prior C)
  - bayesian_rating : shrinkage-adjusted rating
  - peer_percentile : rank of its Bayesian rating within the peer group (0..100)
  - thin_peer_set   : True when the group is smaller than the configured minimum

Peer grouping is configurable (PRD OQ-4): subcategory alone, or subcategory +
price band. Price bands are bucketed so "comparable price" is well defined.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

from config import CONFIG, Config
from deal_score import bayesian_rating
from models import RawProduct

# Price-band edges (USD). A product's band is the bucket its current price falls
# in; used for peer comparison only (PRD data model `price_band`).
_PRICE_BAND_EDGES = [0, 25, 50, 100, 250, 500, 1000, 2500, float("inf")]


def price_band(price: float) -> str:
    for i in range(len(_PRICE_BAND_EDGES) - 1):
        lo, hi = _PRICE_BAND_EDGES[i], _PRICE_BAND_EDGES[i + 1]
        if lo <= price < hi:
            return "2500+" if hi == float("inf") else f"{int(lo)}-{int(hi)}"
    return "unknown"


def peer_key(p: RawProduct, cfg: Config = CONFIG) -> Tuple[str, ...]:
    if cfg.peer_grouping == "subcategory":
        return (p.subcategory,)
    return (p.subcategory, price_band(p.current_price))


def _percentile(value: float, population: List[float]) -> float:
    """Percentile rank of `value`: % of the population at or below it (0..100).

    The median element lands at ~50, so FR-7's ">= 50th percentile" cleanly
    selects the at-or-above-median half.
    """
    n = len(population)
    if n == 0:
        return 0.0
    at_or_below = sum(1 for v in population if v <= value)
    return 100.0 * at_or_below / n


def compute_peer_stats(
    products: List[RawProduct], cfg: Config = CONFIG
) -> Dict[str, dict]:
    """Return per-ASIN peer stats keyed by asin.

    Each value: {category_mean, bayesian_rating, peer_percentile|None,
    thin_peer_set, price_band}.
    """
    groups: Dict[Tuple[str, ...], List[RawProduct]] = {}
    for p in products:
        groups.setdefault(peer_key(p, cfg), []).append(p)

    out: Dict[str, dict] = {}
    for key, members in groups.items():
        category_mean = sum(m.star_rating for m in members) / len(members)
        # Bayesian rating per member uses the peer-group mean as the prior C.
        bayes = {
            m.asin: bayesian_rating(
                m.star_rating, m.review_count or 0, category_mean, cfg=cfg
            )
            for m in members
        }
        thin = len(members) < cfg.min_peer_set
        population = list(bayes.values())
        for m in members:
            out[m.asin] = {
                "category_mean": category_mean,
                "bayesian_rating": bayes[m.asin],
                "peer_percentile": None if thin else _percentile(bayes[m.asin], population),
                "thin_peer_set": thin,
                "price_band": price_band(m.current_price),
            }
    return out
