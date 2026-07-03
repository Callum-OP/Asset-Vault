"""Tests for Google Sign-In (/auth/google).

The Google token verification is mocked so tests never hit Google's servers;
we exercise the upsert/link logic and the app-JWT issuance around it.
"""

import pytest
from fastapi.testclient import TestClient

from app.api.routes import auth as auth_route
from app.services.google_auth import GoogleIdentity

GOOGLE = "/auth/google"


@pytest.fixture
def google_enabled(monkeypatch: pytest.MonkeyPatch):
    """Enable the feature and stub token verification with a controllable fake."""
    monkeypatch.setattr(auth_route.settings, "google_client_id", "test-client-id.apps.googleusercontent.com")

    identity = GoogleIdentity(
        subject="google-sub-123",
        email="guser@example.com",
        email_verified=True,
        full_name="G User",
        avatar_url="https://example.com/avatar.png",
    )

    def fake_verify(token: str) -> GoogleIdentity:
        if token == "bad-token":
            raise ValueError("invalid token")
        return identity

    monkeypatch.setattr(auth_route.google_auth, "verify_google_id_token", fake_verify)
    return identity


def _me(client: TestClient, token: str):
    return client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_google_login_creates_user_and_returns_token(
    client: TestClient, google_enabled: GoogleIdentity
) -> None:
    resp = client.post(GOOGLE, json={"id_token": "good-token"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]

    me = _me(client, token)
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "guser@example.com"
    assert body["full_name"] == "G User"
    assert body["avatar_url"] == "https://example.com/avatar.png"


def test_google_login_is_idempotent_for_same_subject(
    client: TestClient, google_enabled: GoogleIdentity
) -> None:
    first = client.post(GOOGLE, json={"id_token": "good-token"})
    second = client.post(GOOGLE, json={"id_token": "good-token"})
    assert first.status_code == second.status_code == 200

    # Same user resolves both times (same id in the JWT subject via /me).
    id1 = _me(client, first.json()["access_token"]).json()["id"]
    id2 = _me(client, second.json()["access_token"]).json()["id"]
    assert id1 == id2


def test_google_login_links_to_existing_email_account(
    client: TestClient, google_enabled: GoogleIdentity
) -> None:
    # Pre-existing password account with the same email.
    client.post("/auth/register", json={"email": "guser@example.com", "password": "s3curepass"})

    resp = client.post(GOOGLE, json={"id_token": "good-token"})
    assert resp.status_code == 200

    # Password login still works, and both paths resolve to one account.
    pw_login = client.post(
        "/auth/login", data={"username": "guser@example.com", "password": "s3curepass"}
    )
    assert pw_login.status_code == 200
    google_id = _me(client, resp.json()["access_token"]).json()["id"]
    pw_id = _me(client, pw_login.json()["access_token"]).json()["id"]
    assert google_id == pw_id


def test_google_login_rejects_invalid_token(
    client: TestClient, google_enabled: GoogleIdentity
) -> None:
    resp = client.post(GOOGLE, json={"id_token": "bad-token"})
    assert resp.status_code == 401


def test_google_login_rejects_unverified_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_route.settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(
        auth_route.google_auth,
        "verify_google_id_token",
        lambda token: GoogleIdentity("s", "u@example.com", False, None, None),
    )
    resp = client.post(GOOGLE, json={"id_token": "whatever"})
    assert resp.status_code == 401


def test_google_login_disabled_when_unconfigured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_route.settings, "google_client_id", "")
    resp = client.post(GOOGLE, json={"id_token": "whatever"})
    assert resp.status_code == 503
