"""
FastAPI implementation of the PRD Section 10 contract (recommended stack).

Requires: pip install fastapi uvicorn
Run:       uvicorn api_fastapi:app --reload --port 8000

Shares the exact same `service.py` query layer as the stdlib server, so behavior
is identical; this variant adds typed models, OpenAPI docs, and async serving.
"""
from __future__ import annotations

from typing import Optional

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
except ImportError as e:  # pragma: no cover
    raise SystemExit(
        "FastAPI not installed. `pip install fastapi uvicorn`, "
        "or use the zero-dependency server.py instead."
    ) from e

import db
import service
from config import CONFIG

app = FastAPI(title="Prime Day Deal Engine", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _conn():
    conn = db.connect(CONFIG)
    try:
        yield conn
    finally:
        conn.close()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/api/deals")
def list_deals(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    min_discount: Optional[float] = None,
    sort: str = Query(service.DEFAULT_SORT),
    page: int = Query(1, ge=1),
    page_size: int = Query(service.DEFAULT_PAGE_SIZE, ge=1, le=service.MAX_PAGE_SIZE),
):
    conn = db.connect(CONFIG)
    try:
        return service.query_deals(
            conn,
            category=category,
            subcategory=subcategory,
            price_min=price_min,
            price_max=price_max,
            min_discount=min_discount,
            sort=sort,
            page=page,
            page_size=page_size,
        )
    finally:
        conn.close()


@app.get("/api/deals/{asin}")
def get_deal(asin: str):
    conn = db.connect(CONFIG)
    try:
        deal = service.get_deal(conn, asin)
        if deal is None:
            raise HTTPException(status_code=404, detail="not_found")
        return deal
    finally:
        conn.close()


@app.get("/api/categories")
def categories():
    conn = db.connect(CONFIG)
    try:
        return service.get_categories(conn)
    finally:
        conn.close()


# Serve the static frontend from the same origin (single-service deploy).
# Mounted last so it never shadows the /api routes above. Set PDE_SERVE_FRONTEND=0
# to disable (e.g. when hosting the frontend separately).
import os  # noqa: E402

if os.environ.get("PDE_SERVE_FRONTEND", "1") != "0":
    from fastapi.staticfiles import StaticFiles  # noqa: E402

    _frontend = os.path.join(os.path.dirname(__file__), "..", "frontend")
    if os.path.isdir(_frontend):
        app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")


# In-process scheduled ingest (PRD FR-2). Enabled with PDE_ENABLE_SCHEDULER=1 so
# a single always-on web service owns the database and refreshes it 3x daily —
# no separate worker, no shared-disk problem. A baseline run fires on startup in
# a background thread so it never blocks serving.
@app.on_event("startup")
def _maybe_start_scheduler():
    if os.environ.get("PDE_ENABLE_SCHEDULER") != "1":
        return
    import threading

    import db as _db
    import scheduler as _sched

    conn = _db.connect(CONFIG)
    _db.init_db(conn)
    conn.close()

    threading.Thread(target=_sched.tick, daemon=True).start()  # baseline now

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger

        sched = BackgroundScheduler()
        hours = os.environ.get("PDE_INGEST_HOURS", "0,9,15")
        sched.add_job(_sched.tick, CronTrigger.from_crontab(f"0 {hours} * * *"), id="ingest")
        sched.start()
        print(f"[scheduler] in-process ingest scheduled at hours {hours}")
    except ImportError:
        print("[scheduler] APScheduler not installed; baseline run only")


# Free-demo convenience: if the store is empty and we're on the synthetic source,
# seed it on boot in a background thread. Lets a disk-less free instance work with
# zero secrets. Disable with PDE_AUTOSEED=0. Real sources (keepa/paapi) ingest via
# the scheduler instead.
@app.on_event("startup")
def _maybe_autoseed():
    if os.environ.get("PDE_AUTOSEED", "1") == "0":
        return
    if os.environ.get("PDE_INGEST_SOURCE", "mock").lower() not in ("mock", ""):
        return
    import threading

    import db as _db

    conn = _db.connect(CONFIG)
    _db.init_db(conn)
    n = conn.execute("SELECT COUNT(*) AS n FROM products").fetchone()["n"]
    conn.close()
    if n == 0:
        import pipeline as _pl
        from ingestion.mock_source import MockSource

        print("[autoseed] empty store — seeding synthetic demo data…")
        threading.Thread(
            target=lambda: _pl.run(MockSource(), cfg=CONFIG), daemon=True
        ).start()
