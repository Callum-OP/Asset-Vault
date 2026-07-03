"""Auth request schemas."""

from pydantic import BaseModel, Field


class GoogleLoginRequest(BaseModel):
    # The ID token (a JWT credential) returned by Google Identity Services.
    id_token: str = Field(min_length=1)
