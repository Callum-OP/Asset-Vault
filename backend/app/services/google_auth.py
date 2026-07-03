"""Verification of Google Sign-In ID tokens.

The frontend uses Google Identity Services to obtain a signed ID token (a JWT)
and posts it to the backend. Here we verify that token against Google's public
certificates and confirm it was issued for *our* OAuth client, then hand back
the identity fields we care about.
"""

from __future__ import annotations

from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import get_settings

settings = get_settings()

# Reusable transport for fetching/caching Google's signing certificates.
_request = google_requests.Request()


@dataclass
class GoogleIdentity:
    subject: str
    email: str
    email_verified: bool
    full_name: str | None
    avatar_url: str | None


def verify_google_id_token(token: str) -> GoogleIdentity:
    """Validate a Google ID token. Raises ``ValueError`` if it is not valid."""
    claims = google_id_token.verify_oauth2_token(
        token, _request, settings.google_client_id
    )
    return GoogleIdentity(
        subject=claims["sub"],
        email=claims["email"],
        email_verified=bool(claims.get("email_verified", False)),
        full_name=claims.get("name"),
        avatar_url=claims.get("picture"),
    )
