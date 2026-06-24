"""Data-source abstraction (PRD Section 4).

The pipeline depends only on this interface, so the real Keepa source and the
offline mock source are interchangeable.
"""
from __future__ import annotations

from typing import List, Protocol

from models import RawProduct


class DataSource(Protocol):
    def fetch(self, categories: List[str] | None = None) -> List[RawProduct]:
        """Return raw candidate ASINs for the given categories (all if None)."""
        ...
