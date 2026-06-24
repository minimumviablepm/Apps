"""
Export a static snapshot of the curated deals for a build-free static deploy
(e.g. Vercel). Runs the mock pipeline in memory and writes the curated list +
category map to frontend/deals.json. The frontend falls back to this file when
no API is reachable, doing filter/sort/paginate client-side.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import db
import pipeline
import service
from ingestion.mock_source import MockSource

OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "deals.json")


def main():
    conn = db.connect_memory()
    db.init_db(conn)
    summary = pipeline.run(MockSource(), conn=conn)

    deals = []
    page = 1
    while True:
        r = service.query_deals(conn, page=page, page_size=100)
        deals.extend(r["results"])
        if page * 100 >= r["total"]:
            break
        page += 1

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "demo": True,
        "categories": service.get_categories(conn),
        "deals": deals,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    conn.close()
    print(f"Wrote {len(deals)} curated deals to {os.path.abspath(OUT)} "
          f"(ingested={summary['ingested']})")


if __name__ == "__main__":
    main()
