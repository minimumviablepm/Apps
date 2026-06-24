"""Unit tests for the scoring formulas (PRD Section 9) and edge cases (Section 11)."""
import unittest

from tests.helpers import raw

from deal_score import (
    bayesian_rating,
    composite_score,
    pillar_deal_strength,
    pillar_exclusivity,
    pillar_quality,
)
from pipeline import score_products


class TestPillars(unittest.TestCase):
    def test_pillar_a_at_all_time_low(self):
        # current == all_time_low and deep discount -> floor_gap = 1.0, high A.
        a = pillar_deal_strength(reference_price=100.0, current_price=50.0, all_time_low=50.0)
        # depth=0.5, floor_gap=1.0 -> 100*(0.6*0.5 + 0.4*1.0) = 70
        self.assertAlmostEqual(a, 70.0, places=4)

    def test_pillar_a_no_discount_is_zero(self):
        a = pillar_deal_strength(reference_price=100.0, current_price=100.0, all_time_low=80.0)
        # depth=0, floor_gap=clamp(1-0.2)=0.8 -> 100*(0+0.4*0.8)=32
        self.assertAlmostEqual(a, 32.0, places=4)

    def test_pillar_b_rare_vs_common(self):
        self.assertGreater(pillar_exclusivity(5 / 365), pillar_exclusivity(200 / 365))
        self.assertAlmostEqual(pillar_exclusivity(0.0), 100.0)
        self.assertAlmostEqual(pillar_exclusivity(1.0), 0.0)

    def test_pillar_b_short_history_capped(self):
        # Even a rare price is capped at 70 when history is short (Section 11).
        self.assertLessEqual(pillar_exclusivity(0.0, short_history=True), 70.0)

    def test_bayesian_shrinkage_direction(self):
        # Below-average star with few reviews is pulled UP toward the mean.
        b = bayesian_rating(star_rating=4.1, review_count=10, category_mean=4.5)
        self.assertGreater(b, 4.1)
        # Many reviews -> stays near the raw star.
        b2 = bayesian_rating(star_rating=4.1, review_count=100000, category_mean=4.5)
        self.assertAlmostEqual(b2, 4.1, places=1)

    def test_pillar_c_return_penalty(self):
        clean = pillar_quality(4.8, 90.0, "Low")
        penalized = pillar_quality(4.8, 90.0, "High")
        self.assertAlmostEqual(penalized, clean * 0.5, places=4)

    def test_pillar_c_thin_peer_set_uses_quality_only(self):
        # peer_percentile None + thin -> quality_norm at 100% weight.
        c = pillar_quality(5.0, None, "Low", thin_peer_set=True)
        self.assertAlmostEqual(c, 100.0, places=4)

    def test_composite_weighting(self):
        s = composite_score(100.0, 0.0, 0.0)
        self.assertAlmostEqual(s, 40.0)  # Pillar A weight 0.40


class TestEdgeCases(unittest.TestCase):
    def test_null_review_count_fails_gate(self):
        scored = score_products([raw(review_count=None)])[0]
        self.assertFalse(scored.qualified)
        self.assertIn("review_count_unknown", scored.disqualified_reasons)

    def test_snapshot_review_count_flagged_but_qualifies(self):
        scored = score_products([
            raw(asin="B0SNAP0001", review_count_is_snapshot=True)
        ])[0]
        self.assertTrue(scored.qualified)
        self.assertTrue(scored.review_count_stale)

    def test_short_history_flagged_and_capped(self):
        scored = score_products([
            raw(asin="B0NEW00001", price_history_days=60, days_at_or_below_price_365d=1)
        ])[0]
        self.assertTrue(scored.short_history)
        self.assertLessEqual(scored.pillar_exclusivity, 70.0)

    def test_high_return_rate_excluded(self):
        scored = score_products([raw(return_rate_flag="High")])[0]
        self.assertFalse(scored.qualified)
        self.assertIn("return_rate_high", scored.disqualified_reasons)


if __name__ == "__main__":
    unittest.main()
