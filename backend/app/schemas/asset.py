"""Asset request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import AssetType
from app.schemas.category import CategoryRead
from app.schemas.folder import FolderRead
from app.schemas.tag import TagRead


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    is_public: bool
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
    category_id: int | None
    category: CategoryRead | None = None
    folder_id: int | None
    folder: FolderRead | None = None
    tags: list[TagRead] = []
    created_at: datetime
    updated_at: datetime

    # Who shared it (display name only, never the raw email).
    owner_name: str | None = None

    # Social metrics — populated by the API on display endpoints; default to
    # empty for endpoints that don't compute them (e.g. right after an edit).
    like_count: int = 0
    comment_count: int = 0
    liked_by_me: bool = False


class AssetUpdate(BaseModel):
    """Editable fields. Only keys present in the request body are applied."""

    description: str | None = None
    source_url: str | None = None
    category_id: int | None = None
    folder_id: int | None = None
    is_public: bool | None = None


class AssetList(BaseModel):
    items: list[AssetRead]
    total: int
    limit: int
    offset: int


class AssetTagsAdd(BaseModel):
    tag_ids: list[int] = Field(min_length=1)


class AssetBatchUpdate(BaseModel):
    asset_ids: list[int] = Field(min_length=1)
    add_tag_ids: list[int] = []
    remove_tag_ids: list[int] = []
    category_id: int | None = None
    folder_id: int | None = None


class BatchResult(BaseModel):
    updated: int
