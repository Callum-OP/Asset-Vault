"""Association tables for many-to-many relationships."""

from sqlalchemy import Column, ForeignKey, Table

from app.core.database import Base

# Many-to-many link between assets and tags. Kept in its own module so that
# both ``Asset`` and ``Tag`` can import it without a circular dependency.
asset_tags = Table(
    "asset_tags",
    Base.metadata,
    Column("asset_id", ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
