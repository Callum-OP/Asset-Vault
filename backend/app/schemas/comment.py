"""Comment request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    user_id: int
    parent_id: int | None
    author_name: str
    body: str
    created_at: datetime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    # Set to a top-level comment's id to post a reply; omit for a top-level comment.
    parent_id: int | None = None


class LikeStatus(BaseModel):
    """Returned by the like/unlike endpoints so the client can update in place."""

    liked_by_me: bool
    like_count: int
