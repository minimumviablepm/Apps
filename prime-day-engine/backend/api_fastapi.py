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
