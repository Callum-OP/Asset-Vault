"""Asset request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import AssetType


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    stored_filename: str
    file_path: str
    file_size: int
    mime_type: str
    asset_type: AssetType
    thumbnail_path: str | None
    width: int | None
    height: int | None
    dominant_colors: list[str] | None
    description: str | None
    source_url: str | None
    rating: int | None
    category_id: int | None
    created_at: datetime
    updated_at: datetime


class AssetUpdate(BaseModel):
    """Editable fields. Only keys present in the request body are applied."""

    description: str | None = None
    source_url: str | None = None
    rating: int | None = Field(default=None, ge=0, le=5)
    category_id: int | None = None


class AssetList(BaseModel):
    items: list[AssetRead]
    total: int
    limit: int
    offset: int
