"""Tests for the free PA-API "lite" mode: self-recording history + price-only
scoring that degrades gracefully when ratings are unavailable."""
import unittest
from dataclasses import replace

from tests.helpers import raw

import db
import history
from config import CONFIG, Config


def lite_cfg(**kw) -> Config:
    return replace(CONFIG, lite_mode=True, **kw)


DAY = 86400.0


class TestSelfRecordingHistory(unittest.TestCase):
    def setUp(self):
        self.conn = db.connect_memory()
        db.init_db(self.conn)

    def test_first_reading_has_no_discount(self):
        now = 1_000_000_000.0
        history.record(self.conn, "B0X", 50.0, now)
        stats = history.derive_stats(self.conn, "B0X", 50.0, now)
        # Only one observation: averages equal current -> not a discount yet.
        self.assertEqual(stats["avg_price_90d"], 50.0)
        self.assertEqual(stats["all_time_low"], 50.0)
        self.assertEqual(stats["price_history_days"], 1)

    def test_accumulated_history_yields_discount_and_exclusivity(self):
        now = 1_000_000_000.0
        # 30 days of readings at $100, then today's price drops to $70.
        for d in range(30, 0, -1):
            history.record(self.conn, "B0Y", 100.0, now - d * DAY)
        history.record(self.conn, "B0Y", 70.0, now)
        stats = history.derive_stats(self.conn, "B0Y", 70.0, now)
        self.assertGreater(stats["avg_price_90d"], 70.0)        # real discount
        self.assertEqual(stats["all_time_low"], 70.0)           # today is the low
        self.assertEqual(stats["days_at_or_below_price_365d"], 1)  # only today this low


class TestLiteScoring(unittest.TestCase):
    # In lite mode a real discount qualifies even with NO rating/review data.
    def test_lite_qualifies_without_ratings(self):
        from pipeline import score_products
        cfg = lite_cfg()
        r = raw(asin="B0LITE0001", star_rating=0.0, review_count=None,
                current_price=70.0, avg_price_90d=100.0, all_time_low=68.0,
                days_at_or_below_price_365d=3)
        p = score_products([r], cfg=cfg)[0]
        self.assertTrue(p.qualified)
        self.assertIsNone(p.pillar_quality)          # no Pillar C in lite mode
        self.assertIsNotNone(p.pillar_deal_strength)
        self.assertIsNotNone(p.pillar_exclusivity)
        self.assertIsNotNone(p.deal_score)

    # Lite composite uses only the two price pillars, renormalized to 0-100.
    def test_lite_composite_is_price_only(self):
        from deal_score import composite_lite
        cfg = lite_cfg()
        # default lite weights 0.6/0.4
        self.assertAlmostEqual(composite_lite(100.0, 0.0, cfg), 60.0, places=4)
        self.assertAlmostEqual(composite_lite(0.0, 100.0, cfg), 40.0, places=4)
        self.assertAlmostEqual(composite_lite(100.0, 100.0, cfg), 100.0, places=4)

    # A non-discount is still excluded in lite mode (the one gate that remains).
    def test_lite_excludes_non_discount(self):
        from pipeline import score_products
        cfg = lite_cfg()
        r = raw(asin="B0FLAT0001", star_rating=0.0, review_count=None,
                current_price=100.0, avg_price_90d=100.0)
        p = score_products([r], cfg=cfg)[0]
        self.assertFalse(p.qualified)
        self.assertIn("no_real_discount", p.disqualified_reasons)


if __name__ == "__main__":
    unittest.main()
