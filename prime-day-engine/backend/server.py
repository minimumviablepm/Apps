"""
Zero-dependency API server (stdlib http.server) implementing PRD Section 10.

This exists so the engine runs anywhere Python runs, with no pip install. For
production, `api_fastapi.py` exposes the identical contract on FastAPI.

Routes:
    GET /api/deals          filter/sort/paginate (FR-11..16)
    GET /api/deals/{asin}   single product or 404 (PRD Section 10)
    GET /api/categories     category -> [subcategories] map
    GET /healthz            liveness

Run:
    python server.py            # serves on :8000
    PDE_DB_PATH=prime_day.db PORT=8000 python server.py
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import db
import service
from config import CONFIG


def _num(qs, key):
    v = qs.get(key, [None])[0]
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _str(qs, key):
    v = qs.get(key, [None])[0]
    return v or None


class Handler(BaseHTTPRequestHandler):
    server_version = "PrimeDayEngine/1.0"

    # ---- helpers ---- #
    def _send(self, code: int, payload: dict):
        body = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # CORS so the no-build static frontend can call from file:// or any host.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_OPTIONS(self):  # noqa: N802
        self._send(204, {})

    def log_message(self, fmt, *args):  # quieter logs
        pass

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)
        conn = db.connect(CONFIG)
        try:
            if path == "/healthz":
                return self._send(200, {"status": "ok"})

            if path == "/api/categories":
                return self._send(200, service.get_categories(conn))

            if path == "/api/deals":
                result = service.query_deals(
                    conn,
                    category=_str(qs, "category"),
                    subcategory=_str(qs, "subcategory"),
                    price_min=_num(qs, "price_min"),
                    price_max=_num(qs, "price_max"),
                    min_discount=_num(qs, "min_discount"),
                    sort=_str(qs, "sort") or service.DEFAULT_SORT,
                    page=int(_num(qs, "page") or 1),
                    page_size=int(_num(qs, "page_size") or service.DEFAULT_PAGE_SIZE),
                )
                return self._send(200, result)

            if path.startswith("/api/deals/"):
                asin = path.rsplit("/", 1)[-1]
                deal = service.get_deal(conn, asin)
                if deal is None:
                    return self._send(404, {"error": "not_found", "asin": asin})
                return self._send(200, deal)

            return self._send(404, {"error": "not_found", "path": path})
        finally:
            conn.close()


def main():
    port = int(os.environ.get("PORT", "8000"))
    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Prime Day Deal Engine API on http://localhost:{port}  (db={CONFIG.db_path})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == "__main__":
    main()
