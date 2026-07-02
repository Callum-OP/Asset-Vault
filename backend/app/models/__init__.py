"""SQLAlchemy ORM models for LocalAsset Vault.

Importing this package registers every model on ``Base.metadata`` so that
Alembic autogeneration and ``Base.metadata.create_all`` see the full schema.
"""

from app.core.database import Base
from app.models.associations import asset_tags
from app.models.asset import Asset, AssetType
from app.models.category import Category
from app.models.tag import Tag
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "Category",
    "Tag",
    "Asset",
    "AssetType",
    "asset_tags",
]
