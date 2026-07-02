"""Tests for JWT registration, login, and protected routes."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.security import create_access_token

REGISTER = "/auth/register"
LOGIN = "/auth/login"
ME = "/auth/me"

CREDS = {"email": "alice@example.com", "password": "s3curepass"}


def _register(client: TestClient, **overrides) -> None:
    body = {**CREDS, **overrides}
    resp = client.post(REGISTER, json=body)
    assert resp.status_code == 201, resp.text


def _login(client: TestClient, email: str, password: str):
    # OAuth2 password flow uses form fields; email is the "username".
    return client.post(LOGIN, data={"username": email, "password": password})


def test_register_login_and_access_protected_route(client: TestClient) -> None:
    _register(client)

    login_resp = _login(client, CREDS["email"], CREDS["password"])
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]
    assert login_resp.json()["token_type"] == "bearer"

    me_resp = client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == CREDS["email"]


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    _register(client)
    resp = client.post(REGISTER, json=CREDS)
    assert resp.status_code == 409


def test_login_rejects_wrong_password(client: TestClient) -> None:
    _register(client)
    resp = _login(client, CREDS["email"], "wrong-password")
    assert resp.status_code == 401


def test_login_rejects_unknown_email(client: TestClient) -> None:
    resp = _login(client, "nobody@example.com", "whatever12")
    assert resp.status_code == 401


def test_protected_route_requires_token(client: TestClient) -> None:
    resp = client.get(ME)
    assert resp.status_code == 401


def test_protected_route_rejects_invalid_token(client: TestClient) -> None:
    resp = client.get(ME, headers={"Authorization": "Bearer not.a.jwt"})
    assert resp.status_code == 401


def test_protected_route_rejects_expired_token(client: TestClient) -> None:
    _register(client)
    login_user_id = _login(client, CREDS["email"], CREDS["password"])
    # Derive a valid subject then mint an already-expired token for it.
    token = login_user_id.json()["access_token"]
    assert token  # sanity

    expired = create_access_token(subject="1", expires_delta=timedelta(minutes=-5))
    resp = client.get(ME, headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401
