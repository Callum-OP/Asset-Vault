"""Category CRUD (owner-scoped)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models import Category, User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_owned(category_id: int, db: Session, user: User) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return category


def _reject_duplicate(name: str, db: Session, user: User) -> None:
    exists = db.scalar(
        select(Category).where(Category.owner_id == user.id, Category.name == name)
    )
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Category name already exists")


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Category:
    _reject_duplicate(payload.name, db, current_user)
    category = Category(name=payload.name, owner_id=current_user.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(
    current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> list[Category]:
    return list(
        db.scalars(
            select(Category).where(Category.owner_id == current_user.id).order_by(Category.name)
        ).all()
    )


@router.patch("/{category_id}", response_model=CategoryRead)
def rename_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Category:
    category = _get_owned(category_id, db, current_user)
    if payload.name != category.name:
        _reject_duplicate(payload.name, db, current_user)
        category.name = payload.name
        db.commit()
        db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int, current_user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> Response:
    """Delete a category. Assets in it have their category cleared (FK SET NULL)."""
    category = _get_owned(category_id, db, current_user)
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
