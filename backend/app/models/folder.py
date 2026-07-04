"""Folder model — a user-owned, self-nesting container for assets.

Folders describe *where* an asset lives (its project home), distinct from the
flat ``Category`` (*what kind* it is) and free-form ``Tag`` labels. Each folder
may have a parent folder, forming an arbitrarily deep tree per owner. An asset
belongs to at most one folder (see ``Asset.folder_id``); deleting a folder
removes its subfolders but never its assets — those fall back to unfiled.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.user import User


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        # Sibling folders (same parent) must have distinct names per owner.
        # NULLs in ``parent_id`` are distinct in Postgres, so this does not
        # constrain root-level names on its own; that is handled in the route.
        UniqueConstraint("owner_id", "parent_id", "name", name="uq_folder_owner_parent_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="folders")
    parent: Mapped["Folder | None"] = relationship(
        back_populates="children", remote_side="Folder.id"
    )
    children: Mapped[list["Folder"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan"
    )
    # Assets keep their files when a folder is deleted; the FK is SET NULL.
    assets: Mapped[list["Asset"]] = relationship(back_populates="folder")
