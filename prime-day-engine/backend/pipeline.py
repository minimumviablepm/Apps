"""
Ingestion pipeline: ingest -> derive -> peer-rank -> qualify -> score -> persist.

Pure transformation from a list of RawProduct to a list of scored Product, plus
a `run()` that persists to the SQLite store. Token-budget exhaustion and partial
runs are handled by upserting per-batch so a later run resumes cleanly without a
partial wipe (PRD Section 11).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

import db
from config import CONFIG, Config
from deal_score import (
    composite_score,
    pillar_deal_strength,
    pillar_exclusivity,
    pillar_quality,
)
from config import band_for
from ingestion.base import DataSource
from models import Product, RawProduct
from peers import compute_peer_stats, price_band
from qualification import qualify, reference_price


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _exclusivity_pct(raw: RawProduct) -> float:
    days = raw.days_at_or_below_price_365d
    window = max(1, min(365, raw.price_history_days))
    if days is None:
        return 0.0
    return max(0.0, min(1.0, days / window))


def _affiliate_url(asin: str, cfg: Config) -> str:
    return f"https://{cfg.amazon_domain}/dp/{asin}?tag={cfg.affiliate_tag}"


def _camel_url(asin: str) -> str:
    # User-facing independent verification link (PRD FR-19).
    return f"https://camelcamelcamel.com/product/{asin}"


def score_products(
    raws: List[RawProduct],
    cfg: Config = CONFIG,
    ingested_at: Optional[str] = None,
) -> List[Product]:
    """Transform raw products into derived, gated, scored Product records."""
    ingested_at = ingested_at or _now_iso()
    peer_stats = compute_peer_stats(raws, cfg)
    products: List[Product] = []

    for raw in raws:
        ps = peer_stats[raw.asin]
        ref = reference_price(raw, cfg)
        discount_pct = None
        if ref and ref > 0:
            discount_pct = round((ref - raw.current_price) / ref * 100.0, 2)

        gate = qualify(
            raw,
            peer_percentile=ps["peer_percentile"],
            thin_peer_set=ps["thin_peer_set"],
            cfg=cfg,
        )

        excl_pct = _exclusivity_pct(raw)

        pillar_a = pillar_b = pillar_c = deal_score = None
        band = None
        if gate.qualified:
            pillar_a = round(
                pillar_deal_strength(ref, raw.current_price, raw.all_time_low or raw.current_price),
                2,
            )
            pillar_b = round(pillar_exclusivity(excl_pct, gate.short_history, cfg), 2)
            pillar_c = round(
                pillar_quality(
                    ps["bayesian_rating"],
                    ps["peer_percentile"],
                    raw.return_rate_flag,
                    ps["thin_peer_set"],
                    cfg,
                ),
                2,
            )
            deal_score = round(composite_score(pillar_a, pillar_b, pillar_c, cfg), 2)
            band = band_for(deal_score, cfg)

        products.append(
            Product(
                asin=raw.asin,
                title=raw.title,
                image_url=raw.image_url,
                category=raw.category,
                subcategory=raw.subcategory,
                price_band=ps["price_band"],
                current_price=raw.current_price,
                avg_price_90d=raw.avg_price_90d,
                avg_price_180d=raw.avg_price_180d,
                avg_price_365d=raw.avg_price_365d,
                all_time_low=raw.all_time_low,
                reference_price=ref,
                discount_pct=discount_pct,
                star_rating=raw.star_rating,
                review_count=raw.review_count,
                bayesian_rating=round(ps["bayesian_rating"], 4),
                peer_percentile=(
                    round(ps["peer_percentile"], 2)
                    if ps["peer_percentile"] is not None else None
                ),
                return_rate_flag=raw.return_rate_flag,
                days_at_or_below_price_365d=raw.days_at_or_below_price_365d,
                exclusivity_pct=round(excl_pct, 4),
                pillar_deal_strength=pillar_a,
                pillar_exclusivity=pillar_b,
                pillar_quality=pillar_c,
                deal_score=deal_score,
                qualified=gate.qualified,
                affiliate_url=_affiliate_url(raw.asin, cfg),
                camel_url=_camel_url(raw.asin),
                last_ingested_at=ingested_at,
                review_count_stale=gate.review_count_stale,
                short_history=gate.short_history,
                thin_peer_set=gate.thin_peer_set,
                score_band=band,
                disqualified_reasons=gate.reasons,
            )
        )
    return products


def run(
    source: DataSource,
    categories: Optional[List[str]] = None,
    cfg: Config = CONFIG,
    conn=None,
) -> dict:
    """Full ingest run. Returns a summary dict."""
    own_conn = conn is None
    if own_conn:
        conn = db.connect(cfg)
        db.init_db(conn)

    raws = source.fetch(categories)
    products = score_products(raws, cfg)
    db.upsert_products(conn, products)

    qualified = [p for p in products if p.qualified]
    curated = [p for p in qualified if (p.deal_score or 0) >= cfg.display_score_floor]
    summary = {
        "ingested": len(raws),
        "qualified": len(qualified),
        "curated": len(curated),
        "excluded": len(products) - len(qualified),
        "ingested_at": _now_iso(),
    }
    if own_conn:
        conn.close()
    return summary
