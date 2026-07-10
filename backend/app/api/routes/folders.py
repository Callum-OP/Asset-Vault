"""Folder CRUD (owner-scoped, self-nesting tree).

Folders form a per-owner tree via ``parent_id``. Sibling names must be unique.
Moving a folder is guarded against cycles (a folder can't become its own
descendant). Deleting a folder removes its subfolders (DB cascade) but leaves
its assets intact — their ``folder_id`` is cleared to unfiled.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, block_guest_mutations
from app.core.database import get_db
from app.models import Asset, Folder, User
from app.schemas.folder import FolderCreate, FolderRead, FolderUpdate, FolderWithCount

router = APIRouter(
    prefix="/folders", tags=["folders"], dependencies=[Depends(block_guest_mutations)]
)


def _get_owned(folder_id: int, db: Session, user: User) -> Folder:
    folder = db.get(Folder, folder_id)
    if folder is None or folder.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
    return folder


def _validate_parent(parent_id: int | None, db: Session, user: User) -> None:
    """Ensure a proposed parent exists and belongs to the user (None = root)."""
    if parent_id is not None:
        _get_owned(parent_id, db, user)


def _reject_duplicate_sibling(
    name: str, parent_id: int | None, db: Session, user: User, *, exclude_id: int | None = None
) -> None:
    """409 if another folder with this name shares the same parent."""
    stmt = select(Folder).where(
        Folder.owner_id == user.id,
        Folder.parent_id.is_(parent_id) if parent_id is None else Folder.parent_id == parent_id,
        Folder.name == name,
    )
    if exclude_id is not None:
        stmt = stmt.where(Folder.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A folder with that name already exists here")


def _assert_no_cycle(folder: Folder, new_parent_id: int, db: Session, user: User) -> None:
    """Reject moving ``folder`` under itself or one of its own descendants."""
    if new_parent_id == folder.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A folder cannot be its own parent")
    # Walk up from the proposed parent to the root; hitting ``folder`` = cycle.
    ancestor_id: int | None = new_parent_id
    while ancestor_id is not None:
        ancestor = _get_owned(ancestor_id, db, user)
        if ancestor.id == folder.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Cannot move a folder into one of its subfolders"
            )
        ancestor_id = ancestor.parent_id


@router.post("", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(
    payload: FolderCreate, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Folder:
    _validate_parent(payload.parent_id, db, current_user)
    _reject_duplicate_sibling(payload.name, payload.parent_id, db, current_user)
    folder = Folder(name=payload.name, parent_id=payload.parent_id, owner_id=current_user.id)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.get("", response_model=list[FolderWithCount])
def list_folders(
    current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> list[FolderWithCount]:
    """All of the user's folders (flat) with each folder's direct asset count.

    The client nests these into a tree via ``parent_id``.
    """
    folders = db.scalars(
        select(Folder).where(Folder.owner_id == current_user.id).order_by(Folder.name)
    ).all()
    counts = dict(
        db.execute(
            select(Asset.folder_id, func.count())
            .where(Asset.owner_id == current_user.id, Asset.folder_id.is_not(None))
            .group_by(Asset.folder_id)
        ).all()
    )
    return [
        FolderWithCount(
            id=f.id, name=f.name, parent_id=f.parent_id, asset_count=counts.get(f.id, 0)
        )
        for f in folders
    ]


@router.patch("/{folder_id}", response_model=FolderRead)
def update_folder(
    folder_id: int,
    payload: FolderUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Folder:
    """Rename and/or move a folder."""
    folder = _get_owned(folder_id, db, current_user)
    changes = payload.model_dump(exclude_unset=True)

    new_parent_id = changes.get("parent_id", folder.parent_id)
    new_name = changes.get("name", folder.name)

    if "parent_id" in changes and new_parent_id != folder.parent_id:
        _validate_parent(new_parent_id, db, current_user)
        if new_parent_id is not None:
            _assert_no_cycle(folder, new_parent_id, db, current_user)

    # Re-check sibling uniqueness whenever the name or the parent changes.
    if new_name != folder.name or new_parent_id != folder.parent_id:
        _reject_duplicate_sibling(
            new_name, new_parent_id, db, current_user, exclude_id=folder.id
        )

    folder.name = new_name
    folder.parent_id = new_parent_id
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Response:
    """Delete a folder and its subfolders. Assets in them become unfiled."""
    folder = _get_owned(folder_id, db, current_user)
    db.delete(folder)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
