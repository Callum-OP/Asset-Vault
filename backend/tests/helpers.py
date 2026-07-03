"""Shared helpers for API tests."""

from __future__ import annotations

import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image


def png_bytes(color: tuple[int, int, int] = (10, 120, 200), size=(64, 48)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def auth_headers(
    client: TestClient, label: str = "user", password: str = "s3curepass"
) -> dict[str, str]:
    """Register + log in a fresh user, returning its auth header.

    The email is uniquified per call so tests never collide with each other or
    with rows already committed to the (persistent) dev database. ``label`` is
    only a readability hint (e.g. "alice" vs "bob" for multi-user tests).
    """
    email = f"{label}-{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post("/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, resp.text
    token = client.post(
        "/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def upload(
    client: TestClient,
    headers: dict[str, str],
    name: str = "hero.png",
    color: tuple[int, int, int] = (10, 120, 200),
) -> dict:
    resp = client.post(
        "/assets", headers=headers, files={"file": (name, png_bytes(color), "image/png")}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
