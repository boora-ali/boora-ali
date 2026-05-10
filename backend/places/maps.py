from __future__ import annotations

import re

_COORD_PATTERNS = (
    r"@(-?\d+\.\d+),(-?\d+\.\d+)",
    r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)",
    r"[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)",
    r"[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)",
    r"/maps/search/(-?\d+\.\d+)[,+\s]+(-?\d+\.\d+)",
)


def extract_coords(url: str) -> tuple[float, float] | tuple[None, None]:
    """Return the latitude and longitude embedded in a Google Maps URL."""
    for pattern in _COORD_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None, None
