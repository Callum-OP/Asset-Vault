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
from app.models import Asset, AssetLike, AssetType, Category, Comment, Folder, Tag, User
from app.schemas.asset import (
    AssetBatchUpdate,
    AssetList,
    AssetRead,
    AssetTagsAdd,
    AssetUpdate,
    BatchResult,
)
from app.schemas.comment import CommentCreate, CommentRead, LikeStatus
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


_EAGER = (selectinload(Asset.tags), joinedload(Asset.category), joinedload(Asset.folder))


def _validate_owned_folder(folder_id: int | None, db: Session, user: User) -> None:
    """400 if ``folder_id`` is set but not an owned folder. None is allowed."""
    if folder_id is None:
        return
    folder = db.get(Folder, folder_id)
    if folder is None or folder.owner_id != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid folder")


def _folder_and_descendant_ids(root_id: int, db: Session, user: User) -> list[int]:
    """Return ``root_id`` plus every descendant folder id owned by the user."""
    rows = db.execute(
        select(Folder.id, Folder.parent_id).where(Folder.owner_id == user.id)
    ).all()
    children: dict[int | None, list[int]] = {}
    for fid, pid in rows:
        children.setdefault(pid, []).append(fid)

    result: list[int] = []
    stack = [root_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children.get(current, []))
    return result


def _get_owned_asset(asset_id: int, db: Session, user: User) -> Asset:
    """Return the asset if it exists and belongs to the user, else 404."""
    asset = db.get(Asset, asset_id)
    if asset is None or asset.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


def _get_viewable_asset(asset_id: int, db: Session, user: User) -> Asset:
    """Return the asset if the user may view it, else 404.

    A user can view their own assets and any other user's *public* asset.
    Editing/deleting still goes through ``_get_owned_asset``.
    """
    asset = db.get(Asset, asset_id)
    if asset is None or (asset.owner_id != user.id and not asset.is_public):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


def _get_social_asset(asset_id: int, db: Session, user: User) -> Asset:
    """Return a viewable asset that also accepts likes/comments (must be public).

    Social interaction lives on the public surface, so private assets — even
    your own — can't be liked or commented on until they're made public.
    """
    asset = _get_viewable_asset(asset_id, db, user)
    if not asset.is_public:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Likes and comments are only for public assets"
        )
    return asset


def _display_name(user: User) -> str:
    """A friendly name for public display that doesn't leak the full email."""
    return user.full_name or user.email.split("@")[0]


def _comment_read(comment: Comment) -> CommentRead:
    return CommentRead(
        id=comment.id,
        asset_id=comment.asset_id,
        user_id=comment.user_id,
        author_name=_display_name(comment.user),
        body=comment.body,
        created_at=comment.created_at,
    )


def _attach_social(assets: list[Asset], db: Session, user: User) -> list[Asset]:
    """Populate like_count / comment_count / liked_by_me on each asset in place."""
    ids = [a.id for a in assets]
    if not ids:
        return assets
    like_counts = dict(
        db.execute(
            select(AssetLike.asset_id, func.count())
            .where(AssetLike.asset_id.in_(ids))
            .group_by(AssetLike.asset_id)
        ).all()
    )
    comment_counts = dict(
        db.execute(
            select(Comment.asset_id, func.count())
            .where(Comment.asset_id.in_(ids))
            .group_by(Comment.asset_id)
        ).all()
    )
    liked = set(
        db.scalars(
            select(AssetLike.asset_id).where(
                AssetLike.asset_id.in_(ids), AssetLike.user_id == user.id
            )
        ).all()
    )
    for asset in assets:
        asset.like_count = like_counts.get(asset.id, 0)
        asset.comment_count = comment_counts.get(asset.id, 0)
        asset.liked_by_me = asset.id in liked
    return assets


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
    scope: Annotated[
        Literal["mine", "public"],
        Query(description="'mine' = your assets; 'public' = other users' public assets"),
    ] = "mine",
    q: Annotated[str | None, Query(description="Search filename & description")] = None,
    type: Annotated[AssetType | None, Query(description="Filter by asset type")] = None,
    min_rating: Annotated[int | None, Query(ge=0, le=5)] = None,
    category: Annotated[str | None, Query(description="Category name")] = None,
    tag: Annotated[list[str] | None, Query(description="Tag name(s); asset must have all")] = None,
    color: Annotated[str | None, Query(description="Color bucket name or hex")] = None,
    folder_id: Annotated[int | None, Query(description="Filter to a folder")] = None,
    include_subfolders: Annotated[
        bool, Query(description="With folder_id, also include nested folders")
    ] = False,
    unfiled: Annotated[bool, Query(description="Only assets with no folder")] = False,
    sort: SortField = "created_at",
    order: SortOrder = "desc",
) -> AssetList:
    """List assets with optional filtering, search, and sorting.

    ``scope='mine'`` (default) lists the current user's own assets and supports
    folder/category/tag filters. ``scope='public'`` lists *other* users' public
    assets; per-owner filters (folder, category, tag) don't apply there.
    """
    if scope == "public":
        # Every public asset, including the user's own, so they can confirm an
        # asset actually went public. Private assets never appear here.
        stmt: Select = select(Asset).where(Asset.is_public.is_(True))
    else:
        stmt = select(Asset).where(Asset.owner_id == current_user.id)

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Asset.original_filename.ilike(like), Asset.description.ilike(like))
        )
    if type is not None:
        stmt = stmt.where(Asset.asset_type == type)
    if min_rating is not None:
        stmt = stmt.where(Asset.rating >= min_rating)
    if scope == "mine":
        if unfiled:
            stmt = stmt.where(Asset.folder_id.is_(None))
        elif folder_id is not None:
            if include_subfolders:
                ids = _folder_and_descendant_ids(folder_id, db, current_user)
                stmt = stmt.where(Asset.folder_id.in_(ids))
            else:
                stmt = stmt.where(Asset.folder_id == folder_id)
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

    _attach_social(items, db, current_user)
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
    if "folder_id" in fields:
        _validate_owned_folder(payload.folder_id, db, current_user)

    for asset in assets:
        existing = {t.id for t in asset.tags}
        for tag in add_tags:
            if tag.id not in existing:
                asset.tags.append(tag)
        if remove_ids:
            asset.tags = [t for t in asset.tags if t.id not in remove_ids]
        if "category_id" in fields:
            asset.category_id = payload.category_id
        if "folder_id" in fields:
            asset.folder_id = payload.folder_id
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


@router.put("/{asset_id}/thumbnail", response_model=AssetRead)
async def set_asset_thumbnail(
    asset_id: int,
    file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalStorage, Depends(get_storage)],
) -> Asset:
    """Set an asset's thumbnail from an uploaded image.

    Used by the client to persist a snapshot of the 3D viewer so models get a
    real preview in the gallery.
    """
    asset = _get_owned_asset(asset_id, db, current_user)
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty image")
    try:
        thumbnail = media.make_thumbnail(data)
    except OSError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid image")
    asset.thumbnail_path = storage.save_thumbnail(thumbnail, asset.stored_filename)
    # The screenshot is a real raster image, so derive the same preview metadata
    # we extract for uploaded images: dominant colours (and dimensions if absent)
    # so 3D models and videos become colour-searchable from their capture.
    try:
        asset.dominant_colors = media.extract_dominant_colors(data)
        if asset.width is None or asset.height is None:
            asset.width, asset.height = media.extract_dimensions(data)
    except OSError:
        pass
    db.commit()
    db.refresh(asset)
    return asset


# ── Social: likes & comments ─────────────────────────────────────────────────


def _like_count(asset_id: int, db: Session) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(AssetLike).where(AssetLike.asset_id == asset_id)
        )
        or 0
    )


@router.post("/{asset_id}/like", response_model=LikeStatus)
def like_asset(
    asset_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> LikeStatus:
    """Like a public asset (idempotent — liking again is a no-op)."""
    asset = _get_social_asset(asset_id, db, current_user)
    existing = db.scalar(
        select(AssetLike).where(
            AssetLike.asset_id == asset.id, AssetLike.user_id == current_user.id
        )
    )
    if existing is None:
        db.add(AssetLike(asset_id=asset.id, user_id=current_user.id))
        db.commit()
    return LikeStatus(liked_by_me=True, like_count=_like_count(asset.id, db))


@router.delete("/{asset_id}/like", response_model=LikeStatus)
def unlike_asset(
    asset_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> LikeStatus:
    """Remove your like from a public asset (idempotent)."""
    asset = _get_social_asset(asset_id, db, current_user)
    existing = db.scalar(
        select(AssetLike).where(
            AssetLike.asset_id == asset.id, AssetLike.user_id == current_user.id
        )
    )
    if existing is not None:
        db.delete(existing)
        db.commit()
    return LikeStatus(liked_by_me=False, like_count=_like_count(asset.id, db))


@router.get("/{asset_id}/comments", response_model=list[CommentRead])
def list_comments(
    asset_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> list[CommentRead]:
    """List comments on a public asset, oldest first."""
    asset = _get_social_asset(asset_id, db, current_user)
    comments = db.scalars(
        select(Comment)
        .where(Comment.asset_id == asset.id)
        .options(joinedload(Comment.user))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    return [_comment_read(c) for c in comments]


@router.post(
    "/{asset_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED
)
def add_comment(
    asset_id: int,
    payload: CommentCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> CommentRead:
    """Post a comment on a public asset."""
    asset = _get_social_asset(asset_id, db, current_user)
    body = payload.body.strip()
    if not body:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Comment cannot be empty")
    comment = Comment(asset_id=asset.id, user_id=current_user.id, body=body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_read(comment)


@router.delete("/{asset_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    asset_id: int,
    comment_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Delete a comment. Allowed for the comment's author or the asset's owner."""
    comment = db.get(Comment, comment_id)
    if comment is None or comment.asset_id != asset_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    asset = db.get(Asset, asset_id)
    is_author = comment.user_id == current_user.id
    is_asset_owner = asset is not None and asset.owner_id == current_user.id
    if not (is_author or is_asset_owner):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset(
    asset_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Asset:
    """Fetch a single asset the user may view (own, or another user's public)."""
    asset = _get_viewable_asset(asset_id, db, current_user)
    _attach_social([asset], db, current_user)
    return asset


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
    if "folder_id" in changes:
        _validate_owned_folder(changes["folder_id"], db, current_user)

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
