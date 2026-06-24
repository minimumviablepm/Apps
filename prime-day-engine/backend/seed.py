"""
CLI to (re)build the SQLite store.

Offline (default): synthetic data, zero dependencies.
    python seed.py
    python seed.py --per-subcategory 200

Production (Keepa): requires KEEPA_API_KEY and `pip install keepa`.
    python seed.py --source keepa --categories 172282 1055398
"""
from __future__ import annotations

import argparse
import sys

import pipeline
from config import CONFIG
from ingestion.mock_source import MockSource


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Seed the Prime Day Deal Engine store.")
    ap.add_argument("--source", choices=["mock", "keepa", "paapi"], default="mock")
    ap.add_argument("--per-subcategory", type=int, default=120,
                    help="mock only: products generated per subcategory")
    ap.add_argument("--categories", nargs="*", default=None,
                    help="category names (mock) or Keepa node ids (keepa)")
    args = ap.parse_args(argv)

    if args.source == "mock":
        source = MockSource(n_per_subcategory=args.per_subcategory)
    elif args.source == "keepa":
        from ingestion.keepa_source import KeepaSource
        source = KeepaSource()
    else:  # paapi (free lite mode — set PDE_LITE_MODE=1)
        from ingestion.paapi_source import PaapiSource
        source = PaapiSource()

    print(f"Seeding from {args.source} into {CONFIG.db_path} ...")
    summary = pipeline.run(source, categories=args.categories)
    print(
        "Done. ingested={ingested} qualified={qualified} "
        "curated={curated} excluded={excluded}".format(**summary)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
