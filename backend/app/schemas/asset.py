"""Asset response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

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
