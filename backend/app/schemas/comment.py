"""Comment request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    user_id: int
    author_name: str
    body: str
    created_at: datetime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class LikeStatus(BaseModel):
    """Returned by the like/unlike endpoints so the client can update in place."""

    liked_by_me: bool
    like_count: int
