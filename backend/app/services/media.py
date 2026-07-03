"""Media processing: asset-type detection, dimensions, thumbnails, colors."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

from app.models import AssetType

# Extension groups used for type detection and the upload allow-list.
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
GIF_EXTS = {".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}
MODEL_EXTS = {".gltf", ".glb", ".obj", ".fbx"}
ALLOWED_EXTS = IMAGE_EXTS | GIF_EXTS | VIDEO_EXTS | MODEL_EXTS

# Filename hints that mark an image as a texture/material map rather than art.
_TEXTURE_HINTS = (
    "normal", "roughness", "metallic", "metalness", "albedo", "diffuse",
    "specular", "displacement", "height", "_ao", "ambientocclusion", "_orm",
)

# Asset types that carry raster pixels we can thumbnail / analyse.
RASTER_TYPES = {AssetType.image, AssetType.gif, AssetType.texture}

THUMBNAIL_SIZE = (400, 400)
_ANALYSIS_SIZE = (100, 100)


def detect_asset_type(filename: str) -> AssetType | None:
    """Classify by extension. Returns None for unsupported/unknown types."""
    ext = Path(filename).suffix.lower()
    if ext in GIF_EXTS:
        return AssetType.gif
    if ext in VIDEO_EXTS:
        return AssetType.video
    if ext in MODEL_EXTS:
        return AssetType.model_3d
    if ext in IMAGE_EXTS:
        stem = Path(filename).stem.lower()
        if any(hint in stem for hint in _TEXTURE_HINTS):
            return AssetType.texture
        return AssetType.image
    return None


def extract_dimensions(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as img:
        return img.width, img.height


def make_thumbnail(data: bytes) -> bytes:
    """Return PNG bytes of a resized preview (first frame for animated GIFs)."""
    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        img.thumbnail(THUMBNAIL_SIZE)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()


def extract_dominant_colors(data: bytes, count: int = 5) -> list[str]:
    """Return up to ``count`` dominant colors as hex strings, most common first."""
    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB")
        img.thumbnail(_ANALYSIS_SIZE)
        paletted = img.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
        palette = paletted.getpalette() or []
        # getcolors() -> list of (pixel_count, palette_index); sort by frequency.
        counts = sorted(paletted.getcolors() or [], reverse=True)
        colors: list[str] = []
        for _, index in counts:
            r, g, b = palette[index * 3 : index * 3 + 3]
            colors.append(f"#{r:02x}{g:02x}{b:02x}")
        return colors
