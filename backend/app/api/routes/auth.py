"""Authentication routes: register, login, and current-user lookup."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import GoogleLoginRequest
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserRead
from app.services import google_auth

router = APIRouter(prefix="/auth", tags=["auth"])

settings = get_settings()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Annotated[Session, Depends(get_db)]) -> User:
    """Create a new user account."""
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> Token:
    """Exchange email (as ``username``) and password for an access token."""
    user = db.scalar(select(User).where(User.email == form.username))
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.post("/google", response_model=Token)
def login_with_google(
    payload: GoogleLoginRequest, db: Annotated[Session, Depends(get_db)]
) -> Token:
    """Verify a Google ID token, upsert the user, and issue an app access token."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured",
        )

    try:
        identity = google_auth.verify_google_id_token(payload.id_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        )
    if not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified",
        )

    # 1) Existing Google-linked user? 2) Existing email user to link? 3) New user.
    user = db.scalar(
        select(User).where(
            User.oauth_provider == "google", User.oauth_subject == identity.subject
        )
    )
    if user is None:
        user = db.scalar(select(User).where(User.email == identity.email))
        if user is None:
            user = User(email=identity.email, hashed_password=None)
            db.add(user)
        user.oauth_provider = "google"
        user.oauth_subject = identity.subject

    # Backfill profile fields from Google without clobbering user-set values.
    if identity.full_name and not user.full_name:
        user.full_name = identity.full_name
    if identity.avatar_url and not user.avatar_url:
        user.avatar_url = identity.avatar_url

    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(subject=str(user.id)))


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: CurrentUser) -> User:
    """Return the authenticated user (protected route example)."""
    return current_user
