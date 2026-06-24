"""Acceptance tests mapping 1:1 to PRD Section 12 (AC-1 .. AC-8)."""
import unittest

from tests.helpers import raw, product

import db
import service
from config import CONFIG
from peers import compute_peer_stats
from pipeline import score_products, _camel_url
from qualification import qualify


def _gate(r, percentile=80.0, thin=False):
    return qualify(r, peer_percentile=percentile, thin_peer_set=thin)


class TestAcceptance(unittest.TestCase):
    # AC-1 — a 3.9-star product is excluded regardless of discount depth.
    def test_ac1_star_floor(self):
        r = raw(star_rating=3.9, current_price=10.0, all_time_low=10.0)  # huge discount
        res = _gate(r)
        self.assertFalse(res.qualified)
        self.assertIn("star_rating<4.0", res.reasons)

    # AC-2 — 4.6 stars but 800 reviews is excluded (review floor).
    def test_ac2_review_floor(self):
        r = raw(star_rating=4.6, review_count=800)
        res = _gate(r)
        self.assertFalse(res.qualified)
        self.assertIn("review_count<1000", res.reasons)

    # AC-3 — current price == 90-day average -> no real discount -> excluded.
    def test_ac3_real_discount_only(self):
        r = raw(current_price=100.0, avg_price_90d=100.0)
        res = _gate(r)
        self.assertFalse(res.qualified)
        self.assertIn("no_real_discount", res.reasons)

    # AC-4 — of two same-subcategory products, only the at-or-above-median
    # Bayesian-rating one qualifies.
    def test_ac4_peer_outperformance(self):
        pop = []
        # 21 peers in the same subcategory + price band, varied star ratings so
        # Bayesian ratings spread out and percentiles are well separated.
        for i in range(21):
            star = round(4.0 + (i % 10) * 0.09, 2)  # 4.0 .. 4.81
            pop.append(
                raw(asin=f"B1{i:08d}", star_rating=star, review_count=5000,
                    current_price=120.0, avg_price_90d=150.0, all_time_low=110.0)
            )
        stats = compute_peer_stats(pop)
        ranked = sorted(pop, key=lambda p: stats[p.asin]["bayesian_rating"])
        below, above = ranked[0], ranked[-1]

        self.assertLess(stats[below.asin]["peer_percentile"], 50.0)
        self.assertGreaterEqual(stats[above.asin]["peer_percentile"], 50.0)

        above_res = qualify(above, peer_percentile=stats[above.asin]["peer_percentile"], thin_peer_set=False)
        below_res = qualify(below, peer_percentile=stats[below.asin]["peer_percentile"], thin_peer_set=False)
        self.assertTrue(above_res.qualified)
        self.assertFalse(below_res.qualified)
        self.assertIn("peer_percentile<50.0", below_res.reasons)

    # AC-5 — identical discount depth; rarer price (5/365 vs 200/365) scores a
    # strictly higher Pillar B and a strictly higher composite.
    def test_ac5_exclusivity_scoring(self):
        rare = raw(asin="B0RARE0001", days_at_or_below_price_365d=5)
        common = raw(asin="B0COMMON01", days_at_or_below_price_365d=200)
        scored = {p.asin: p for p in score_products([rare, common])}
        self.assertTrue(scored["B0RARE0001"].qualified)
        self.assertTrue(scored["B0COMMON01"].qualified)
        self.assertGreater(
            scored["B0RARE0001"].pillar_exclusivity,
            scored["B0COMMON01"].pillar_exclusivity,
        )
        self.assertGreater(
            scored["B0RARE0001"].deal_score, scored["B0COMMON01"].deal_score
        )

    # AC-6 — combined filter + sort returns only matching rows, ordered by
    # descending discount.
    def test_ac6_combined_filter_sort(self):
        conn = db.connect_memory()
        db.init_db(conn)
        rows = [
            product(asin="B0E1", category="Electronics", current_price=150.0,
                    discount_pct=40.0, deal_score=85.0),
            product(asin="B0E2", category="Electronics", current_price=199.0,
                    discount_pct=55.0, deal_score=82.0),
            product(asin="B0E3", category="Electronics", current_price=180.0,
                    discount_pct=25.0, deal_score=80.0),   # discount too low
            product(asin="B0E4", category="Electronics", current_price=250.0,
                    discount_pct=60.0, deal_score=88.0),   # too pricey
            product(asin="B0H1", category="Home & Kitchen", current_price=120.0,
                    discount_pct=50.0, deal_score=90.0),   # wrong category
        ]
        db.upsert_products(conn, rows)
        out = service.query_deals(
            conn, category="Electronics", price_max=200.0,
            min_discount=30.0, sort="discount",
        )
        asins = [r["asin"] for r in out["results"]]
        self.assertEqual(asins, ["B0E2", "B0E1"])  # 55% then 40%
        for r in out["results"]:
            self.assertEqual(r["category"], "Electronics")
            self.assertLessEqual(r["current_price"], 200.0)
            self.assertGreaterEqual(r["discount_pct"], 30.0)

    # AC-7 — verification link points to the correct CamelCamelCamel chart.
    def test_ac7_verification_link(self):
        self.assertEqual(
            _camel_url("B0ABCDEFGH"),
            "https://camelcamelcamel.com/product/B0ABCDEFGH",
        )
        scored = score_products([raw(asin="B0ABCDEFGH")])[0]
        self.assertEqual(scored.camel_url, "https://camelcamelcamel.com/product/B0ABCDEFGH")

    # AC-8 — default state (no sort) is ordered by Deal Score descending.
    def test_ac8_default_sort(self):
        conn = db.connect_memory()
        db.init_db(conn)
        db.upsert_products(conn, [
            product(asin="B0S1", deal_score=72.0),
            product(asin="B0S2", deal_score=95.0),
            product(asin="B0S3", deal_score=83.0),
        ])
        out = service.query_deals(conn)  # no sort param -> default
        self.assertEqual(out["sort"], "deal_score")
        scores = [r["deal_score"] for r in out["results"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertEqual([r["asin"] for r in out["results"]], ["B0S2", "B0S3", "B0S1"])


if __name__ == "__main__":
    unittest.main()
