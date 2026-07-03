"""Asset routes: upload (Phase 3). CRUD & listing arrive in Phase 4."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.sql import Select

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.database import get_db
from app.models import Asset, AssetType, Category, Tag, User
from app.schemas.asset import (
    AssetBatchUpdate,
    AssetList,
    AssetRead,
    AssetTagsAdd,
    AssetUpdate,
    BatchResult,
)
from app.services import color as color_service
from app.services import media
from app.services.storage import LocalStorage, get_storage

_SORT_COLUMNS = {
    "created_at": Asset.created_at,
    "rating": Asset.rating,
    "file_size": Asset.file_size,
    "original_filename": Asset.original_filename,
}
SortField = Literal["created_at", "rating", "file_size", "original_filename"]
SortOrder = Literal["asc", "desc"]

router = APIRouter(prefix="/assets", tags=["assets"])

settings = get_settings()


_EAGER = (selectinload(Asset.tags), joinedload(Asset.category))


def _get_owned_asset(asset_id: int, db: Session, user: User) -> Asset:
    """Return the asset if it exists and belongs to the user, else 404."""
    asset = db.get(Asset, asset_id)
    if asset is None or asset.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


def _get_owned_tags(tag_ids: list[int], db: Session, user: User) -> list[Tag]:
    """Fetch the user's tags for the given ids, or 400 if any is missing."""
    if not tag_ids:
        return []
    unique_ids = set(tag_ids)
    tags = db.scalars(
        select(Tag).where(Tag.id.in_(unique_ids), Tag.owner_id == user.id)
    ).all()
    if len(tags) != len(unique_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more tags not found")
    return list(tags)


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
    q: Annotated[str | None, Query(description="Search filename & description")] = None,
    type: Annotated[AssetType | None, Query(description="Filter by asset type")] = None,
    min_rating: Annotated[int | None, Query(ge=0, le=5)] = None,
    category: Annotated[str | None, Query(description="Category name")] = None,
    tag: Annotated[list[str] | None, Query(description="Tag name(s); asset must have all")] = None,
    color: Annotated[str | None, Query(description="Color bucket name or hex")] = None,
    sort: SortField = "created_at",
    order: SortOrder = "desc",
) -> AssetList:
    """List the current user's assets with optional filtering, search, and sorting."""
    stmt: Select = select(Asset).where(Asset.owner_id == current_user.id)

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Asset.original_filename.ilike(like), Asset.description.ilike(like))
        )
    if type is not None:
        stmt = stmt.where(Asset.asset_type == type)
    if min_rating is not None:
        stmt = stmt.where(Asset.rating >= min_rating)
    if category:
        stmt = stmt.where(
            Asset.category.has(
                and_(
                    func.lower(Category.name) == category.lower(),
                    Category.owner_id == current_user.id,
                )
            )
        )
    for tag_name in tag or []:
        stmt = stmt.where(
            Asset.tags.any(
                and_(
                    func.lower(Tag.name) == tag_name.lower(),
                    Tag.owner_id == current_user.id,
                )
            )
        )

    sort_col = _SORT_COLUMNS[sort]
    sort_col = sort_col.asc() if order == "asc" else sort_col.desc()
    stmt = stmt.order_by(sort_col, Asset.id.desc())

    # Color matching is bucket-based, so it's applied in Python after the SQL
    # filters. Acceptable for a personal-scale library.
    if color:
        bucket = color_service.resolve_query_color(color)
        if bucket is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown color: {color}")
        rows = [
            a for a in db.scalars(stmt.options(*_EAGER)).all()
            if color_service.colors_match_bucket(a.dominant_colors, bucket)
        ]
        total = len(rows)
        items = rows[offset : offset + limit]
    else:
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = list(db.scalars(stmt.options(*_EAGER).limit(limit).offset(offset)).all())

    return AssetList(items=items, total=total, limit=limit, offset=offset)


@router.post("/batch", response_model=BatchResult)
def batch_update_assets(
    payload: AssetBatchUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BatchResult:
    """Apply tag/category/rating changes to many owned assets at once."""
    unique_ids = set(payload.asset_ids)
    assets = db.scalars(
        select(Asset)
        .where(Asset.id.in_(unique_ids), Asset.owner_id == current_user.id)
        .options(selectinload(Asset.tags))
    ).all()
    if len(assets) != len(unique_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more assets not found")

    add_tags = _get_owned_tags(payload.add_tag_ids, db, current_user)
    _get_owned_tags(payload.remove_tag_ids, db, current_user)  # validate ownership
    remove_ids = set(payload.remove_tag_ids)

    fields = payload.model_fields_set
    if "category_id" in fields and payload.category_id is not None:
        category = db.get(Category, payload.category_id)
        if category is None or category.owner_id != current_user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid category")

    for asset in assets:
        existing = {t.id for t in asset.tags}
        for tag in add_tags:
            if tag.id not in existing:
                asset.tags.append(tag)
        if remove_ids:
            asset.tags = [t for t in asset.tags if t.id not in remove_ids]
        if "category_id" in fields:
            asset.category_id = payload.category_id
        if "rating" in fields:
            asset.rating = payload.rating

    db.commit()
    return BatchResult(updated=len(assets))


@router.post("/{asset_id}/tags", response_model=AssetRead)
def add_asset_tags(
    asset_id: int,
    payload: AssetTagsAdd,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Asset:
    """Attach one or more tags to an asset (idempotent)."""
    asset = _get_owned_asset(asset_id, db, current_user)
    existing = {t.id for t in asset.tags}
    for tag in _get_owned_tags(payload.tag_ids, db, current_user):
        if tag.id not in existing:
            asset.tags.append(tag)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}/tags/{tag_id}", response_model=AssetRead)
def remove_asset_tag(
    asset_id: int,
    tag_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Asset:
    """Detach a single tag from an asset."""
    asset = _get_owned_asset(asset_id, db, current_user)
    asset.tags = [t for t in asset.tags if t.id != tag_id]
    db.commit()
    db.refresh(asset)
    return asset


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
