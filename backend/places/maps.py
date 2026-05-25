from __future__ import annotations

import re

_COORD_PATTERNS = (
    r"@(-?\d+\.\d+),(-?\d+\.\d+)",
    r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)",
    r"[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)",
    r"[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)",
    r"/maps/search/(-?\d+\.\d+)[,+\s]+(-?\d+\.\d+)",
)

# Matches Google Maps encoded place IDs: !1s0x<high>:0x<low>
# The lower 64-bit value (hex2) is the CID used in ?cid= lookups.
_PLACE_ID_RE = re.compile(r"!1s(0x[0-9a-f]+):(0x[0-9a-f]+)", re.IGNORECASE)


def extract_coords(url: str) -> tuple[float, float] | tuple[None, None]:
    """Return the latitude and longitude embedded in a Google Maps URL."""
    for pattern in _COORD_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None, None


def extract_place_cid(url: str) -> int | None:
    """Extract Google Maps CID from a URL containing !1s<high>:<low> encoding.

    Returns the lower 64-bit value as a decimal integer, suitable for use in
    ``https://maps.google.com/maps?cid=<cid>`` which always redirects to a
    coordinate-bearing URL.  Returns None if no place ID is found.
    """
    match = _PLACE_ID_RE.search(url)
    if not match:
        return None
    return int(match.group(2), 16)
