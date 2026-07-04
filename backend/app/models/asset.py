"""Asset model — a stored creative file plus its extracted metadata."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.associations import asset_tags

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.folder import Folder
    from app.models.tag import Tag
    from app.models.user import User


class AssetType(str, enum.Enum):
    """Coarse classification of an asset by extension / MIME type."""

    image = "image"
    gif = "gif"
    video = "video"
    model_3d = "model_3d"
    texture = "texture"
    other = "other"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # An asset's home folder. Null means "unfiled" (shown at the tree root).
    # Deleting the folder clears this (SET NULL) rather than deleting the asset.
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # File identity & storage
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(127), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(
        SQLEnum(AssetType, name="asset_type"), nullable=False, default=AssetType.other
    )

    # Preview & extracted metadata
    thumbnail_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dominant_colors: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    # User-editable fields
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="assets")
    category: Mapped["Category | None"] = relationship(back_populates="assets")
    folder: Mapped["Folder | None"] = relationship(back_populates="assets")
    tags: Mapped[list["Tag"]] = relationship(secondary=asset_tags, back_populates="assets")
