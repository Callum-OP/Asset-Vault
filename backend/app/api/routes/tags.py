"""Tag CRUD (owner-scoped)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, block_guest_mutations
from app.core.database import get_db
from app.models import Tag, User
from app.schemas.tag import TagCreate, TagRead, TagUpdate

router = APIRouter(
    prefix="/tags", tags=["tags"], dependencies=[Depends(block_guest_mutations)]
)


def _get_owned(tag_id: int, db: Session, user: User) -> Tag:
    tag = db.get(Tag, tag_id)
    if tag is None or tag.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not found")
    return tag


def _reject_duplicate(name: str, db: Session, user: User) -> None:
    exists = db.scalar(select(Tag).where(Tag.owner_id == user.id, Tag.name == name))
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tag name already exists")


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    payload: TagCreate, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Tag:
    _reject_duplicate(payload.name, db, current_user)
    tag = Tag(name=payload.name, owner_id=current_user.id)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.get("", response_model=list[TagRead])
def list_tags(current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> list[Tag]:
    return list(
        db.scalars(
            select(Tag).where(Tag.owner_id == current_user.id).order_by(Tag.name)
        ).all()
    )


@router.patch("/{tag_id}", response_model=TagRead)
def rename_tag(
    tag_id: int,
    payload: TagUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Tag:
    tag = _get_owned(tag_id, db, current_user)
    if payload.name != tag.name:
        _reject_duplicate(payload.name, db, current_user)
        tag.name = payload.name
        db.commit()
        db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Response:
    """Delete a tag. Its links to assets are removed (asset_tags CASCADE)."""
    tag = _get_owned(tag_id, db, current_user)
    db.delete(tag)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
