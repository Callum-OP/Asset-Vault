"""Asset routes: upload (Phase 3). CRUD & listing arrive in Phase 4."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.database import get_db
from app.models import Asset
from app.schemas.asset import AssetRead
from app.services import media
from app.services.storage import LocalStorage, get_storage

router = APIRouter(prefix="/assets", tags=["assets"])

settings = get_settings()


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalStorage, Depends(get_storage)],
) -> Asset:
    """Upload a file: store it, detect its type, and extract preview metadata."""
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing filename")

    asset_type = media.detect_asset_type(file.filename)
    if asset_type is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type: {Path(file.filename).suffix or '(none)'}",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"File exceeds maximum size of {settings.max_upload_bytes} bytes",
        )

    extension = Path(file.filename).suffix.lower()
    stored_name, file_path = storage.save_file(data, extension)

    width = height = None
    thumbnail_path: str | None = None
    dominant_colors: list[str] | None = None

    if asset_type in media.RASTER_TYPES:
        try:
            width, height = media.extract_dimensions(data)
            thumbnail_path = storage.save_thumbnail(media.make_thumbnail(data), stored_name)
            dominant_colors = media.extract_dominant_colors(data)
        except OSError:
            # Corrupt/undecodable image: keep the file, skip preview metadata.
            width = height = None
            thumbnail_path = None
            dominant_colors = None

    mime_type = (
        mimetypes.guess_type(file.filename)[0]
        or file.content_type
        or "application/octet-stream"
    )

    asset = Asset(
        owner_id=current_user.id,
        original_filename=file.filename,
        stored_filename=stored_name,
        file_path=file_path,
        file_size=len(data),
        mime_type=mime_type,
        asset_type=asset_type,
        thumbnail_path=thumbnail_path,
        width=width,
        height=height,
        dominant_colors=dominant_colors,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset
