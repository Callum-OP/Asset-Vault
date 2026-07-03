"""Asset routes: upload (Phase 3). CRUD & listing arrive in Phase 4."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.database import get_db
from app.models import Asset, Category, User
from app.schemas.asset import AssetList, AssetRead, AssetUpdate
from app.services import media
from app.services.storage import LocalStorage, get_storage

router = APIRouter(prefix="/assets", tags=["assets"])

settings = get_settings()


def _get_owned_asset(asset_id: int, db: Session, user: User) -> Asset:
    """Return the asset if it exists and belongs to the user, else 404."""
    asset = db.get(Asset, asset_id)
    if asset is None or asset.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


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


@router.get("", response_model=AssetList)
def list_assets(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AssetList:
    """List the current user's assets, newest first, paginated."""
    owned = select(Asset).where(Asset.owner_id == current_user.id)
    total = db.scalar(select(func.count()).select_from(owned.subquery())) or 0
    items = db.scalars(
        owned.order_by(Asset.created_at.desc(), Asset.id.desc()).limit(limit).offset(offset)
    ).all()
    return AssetList(items=list(items), total=total, limit=limit, offset=offset)


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset(
    asset_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Asset:
    """Fetch a single owned asset."""
    return _get_owned_asset(asset_id, db, current_user)


@router.patch("/{asset_id}", response_model=AssetRead)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Asset:
    """Update editable metadata (description, source_url, rating, category)."""
    asset = _get_owned_asset(asset_id, db, current_user)
    changes = payload.model_dump(exclude_unset=True)

    new_category_id = changes.get("category_id")
    if new_category_id is not None:
        category = db.get(Category, new_category_id)
        if category is None or category.owner_id != current_user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid category")

    for field, value in changes.items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalStorage, Depends(get_storage)],
) -> Response:
    """Delete an owned asset and its stored file + thumbnail."""
    asset = _get_owned_asset(asset_id, db, current_user)
    storage.delete(asset.file_path)
    storage.delete(asset.thumbnail_path)
    db.delete(asset)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
