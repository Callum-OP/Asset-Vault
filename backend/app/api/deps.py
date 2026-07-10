"""Shared FastAPI dependencies (auth, current user)."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Resolve the authenticated user from a bearer JWT, or raise 401."""
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise _credentials_exception
        user_id = int(subject)
    except (jwt.PyJWTError, ValueError):
        raise _credentials_exception

    user = db.get(User, user_id)
    if user is None:
        raise _credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def block_guest_mutations(request: Request, current_user: CurrentUser) -> None:
    """Reject write requests from the shared, read-only guest account.

    Applied as a router-level dependency so no individual write endpoint can
    accidentally admit a guest: any non-safe HTTP method (POST/PUT/PATCH/DELETE)
    from a guest is refused, while reads pass through unchanged.
    """
    if current_user.is_guest and request.method not in _SAFE_METHODS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guests have read-only access. Sign in to make changes.",
        )
