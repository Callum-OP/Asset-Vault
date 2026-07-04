"""Folder schemas."""

from pydantic import BaseModel, ConfigDict, Field


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    parent_id: int | None = None


class FolderUpdate(BaseModel):
    """Rename and/or move a folder.

    Only keys present in the request body are applied, so ``parent_id=null``
    (move to root) is distinguishable from an omitted ``parent_id`` (keep it).
    """

    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: int | None = None


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: int | None


class FolderWithCount(FolderRead):
    """A folder plus the number of assets filed directly in it."""

    asset_count: int
