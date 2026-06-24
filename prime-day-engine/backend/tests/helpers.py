"""Shared test helpers: put the backend package dir on sys.path and provide
factory functions for RawProduct / Product with qualifying defaults."""
import os
import sys

# Make `config`, `deal_score`, etc. importable when running `python -m unittest`
# from the backend directory or the repo root.
BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from models import Product, RawProduct  # noqa: E402


def raw(**kw) -> RawProduct:
    """A RawProduct that passes the full gate by default."""
    base = dict(
        asin="B000000001",
        title="Test Product",
        image_url=None,
        category="Electronics",
        subcategory="Headphones",
        current_price=80.0,
        avg_price_90d=100.0,   # current < 90d avg -> real discount
        avg_price_180d=105.0,
        avg_price_365d=110.0,
        all_time_low=75.0,
        star_rating=4.5,
        review_count=5000,
        sales_rank=100,
        return_rate_flag="Low",
        days_at_or_below_price_365d=10,
        price_history_days=365,
        review_count_is_snapshot=False,
    )
    base.update(kw)
    return RawProduct(**base)


def product(**kw) -> Product:
    """A fully-formed, qualified Product for store/service tests."""
    base = dict(
        asin="B000000001",
        title="Test Product",
        image_url=None,
        category="Electronics",
        subcategory="Headphones",
        price_band="50-100",
        current_price=80.0,
        avg_price_90d=100.0,
        avg_price_180d=105.0,
        avg_price_365d=110.0,
        all_time_low=75.0,
        reference_price=100.0,
        discount_pct=20.0,
        star_rating=4.5,
        review_count=5000,
        bayesian_rating=4.4,
        peer_percentile=80.0,
        return_rate_flag="Low",
        days_at_or_below_price_365d=10,
        exclusivity_pct=0.027,
        pillar_deal_strength=70.0,
        pillar_exclusivity=90.0,
        pillar_quality=80.0,
        deal_score=80.0,
        qualified=True,
        affiliate_url="https://www.amazon.com/dp/B000000001?tag=monicadeals-20",
        camel_url="https://camelcamelcamel.com/product/B000000001",
        last_ingested_at="2026-06-24T00:00:00+00:00",
        score_band="Strong",
    )
    base.update(kw)
    return Product(**base)
