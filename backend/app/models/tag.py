"""Tag model — user-owned label attachable to many assets."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.associations import asset_tags

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.user import User


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_tag_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    owner: Mapped["User"] = relationship(back_populates="tags")
    assets: Mapped[list["Asset"]] = relationship(secondary=asset_tags, back_populates="tags")
