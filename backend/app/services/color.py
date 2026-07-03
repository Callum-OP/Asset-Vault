"""Coarse color classification for the ``color`` search filter.

Dominant colors are stored as hex strings. To support human-friendly queries
like ``color=gray`` or ``color=blue`` (and hex values from a color picker), we
map each color to one of a small set of named buckets and match on the bucket.
"""

from __future__ import annotations

import colorsys
import re

BUCKETS = frozenset(
    {"red", "orange", "yellow", "green", "cyan", "blue", "purple",
     "pink", "brown", "black", "white", "gray"}
)

_ALIASES = {"grey": "gray"}
_HEX_RE = re.compile(r"^#?[0-9a-fA-F]{6}$")


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    h = value.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def classify_color(value: str) -> str:
    """Map a hex color to a named bucket using HSV thresholds."""
    r, g, b = _hex_to_rgb(value)
    hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hue *= 360

    if val < 0.15:
        return "black"
    if sat < 0.12:
        return "white" if val > 0.85 else "gray"
    # Dark, low-saturation oranges read as brown rather than orange.
    if 20 <= hue < 45 and val < 0.6:
        return "brown"

    if hue < 15 or hue >= 345:
        return "red"
    if hue < 45:
        return "orange"
    if hue < 70:
        return "yellow"
    if hue < 170:
        return "green"
    if hue < 200:
        return "cyan"
    if hue < 255:
        return "blue"
    if hue < 290:
        return "purple"
    return "pink"


def resolve_query_color(value: str) -> str | None:
    """Resolve a query value (bucket name or hex) to a bucket, or None if invalid."""
    normalized = _ALIASES.get(value.strip().lower(), value.strip().lower())
    if normalized in BUCKETS:
        return normalized
    if _HEX_RE.match(value.strip()):
        return classify_color(value.strip())
    return None


def colors_match_bucket(colors: list[str] | None, bucket: str) -> bool:
    """True if any of the asset's dominant colors falls in the given bucket."""
    return any(classify_color(c) == bucket for c in (colors or []))
