"""Filesystem storage service.

Files and thumbnails are stored on the local filesystem under a base directory.
The public surface (save/delete + relative paths) is deliberately small so a
future backend (S3/MinIO) can be swapped in without touching callers.
"""

from __future__ import annotations

import uuid
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

FILES_SUBDIR = "files"
THUMBS_SUBDIR = "thumbnails"


class LocalStorage:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = Path(base_dir)
        self.files_dir = self.base_dir / FILES_SUBDIR
        self.thumbs_dir = self.base_dir / THUMBS_SUBDIR
        self.files_dir.mkdir(parents=True, exist_ok=True)
        self.thumbs_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, data: bytes, extension: str) -> tuple[str, str]:
        """Persist file bytes under a random name. Returns (stored_name, relative_path)."""
        stored_name = f"{uuid.uuid4().hex}{extension.lower()}"
        (self.files_dir / stored_name).write_bytes(data)
        return stored_name, f"{FILES_SUBDIR}/{stored_name}"

    def save_thumbnail(self, data: bytes, stored_name: str) -> str:
        """Persist a PNG thumbnail keyed to the file's stored name. Returns relative path."""
        thumb_name = f"{Path(stored_name).stem}.png"
        (self.thumbs_dir / thumb_name).write_bytes(data)
        return f"{THUMBS_SUBDIR}/{thumb_name}"

    def resolve(self, relative_path: str) -> Path:
        """Map a stored relative path back to an absolute path on disk."""
        return self.base_dir / relative_path

    def delete(self, relative_path: str | None) -> None:
        if relative_path:
            self.resolve(relative_path).unlink(missing_ok=True)


@lru_cache
def get_storage() -> LocalStorage:
    """FastAPI dependency yielding the configured storage backend."""
    return LocalStorage(Path(get_settings().storage_dir))
