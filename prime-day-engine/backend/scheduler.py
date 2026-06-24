"""
Scheduled ingestion (PRD FR-2): a pre-event baseline run plus >= 3 runs/day
during the event window, aligned to Amazon's deal-drop cadence.

Uses APScheduler if available; otherwise falls back to a simple sleep loop so it
still runs with zero dependencies. Each tick reuses pipeline.run(), which upserts
per run and therefore resumes cleanly after a token-budget cutoff (PRD Section 11).
"""
from __future__ import annotations

import time

import pipeline
from config import CONFIG
from ingestion.mock_source import MockSource


def make_source():
    # Swap to KeepaSource() in production (requires KEEPA_API_KEY).
    return MockSource()


def tick():
    summary = pipeline.run(make_source(), cfg=CONFIG)
    print("[ingest]", summary)
    return summary


def run_scheduled():
    # Deal drops cluster around 00:00, 09:00, 15:00 local (3x daily, FR-2).
    hours = "0,9,15"
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.cron import CronTrigger

        sched = BlockingScheduler()
        sched.add_job(tick, CronTrigger.from_crontab(f"0 {hours} * * *"), id="ingest")
        print(f"Scheduled ingest at hours {hours} daily. Running baseline now...")
        tick()  # baseline run on startup
        sched.start()
    except ImportError:
        print("APScheduler not installed; falling back to 8h sleep loop.")
        while True:
            tick()
            time.sleep(8 * 3600)


if __name__ == "__main__":
    run_scheduled()
