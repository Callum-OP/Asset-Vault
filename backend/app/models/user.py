"""User model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.category import Category
    from app.models.tag import Tag


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_subject", name="uq_user_oauth"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    # Null for accounts that authenticate only via an OAuth provider.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # OAuth identity (e.g. provider="google", subject=Google's stable "sub").
    oauth_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    oauth_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Optional profile fields populated from the OAuth provider.
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    assets: Mapped[list["Asset"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
