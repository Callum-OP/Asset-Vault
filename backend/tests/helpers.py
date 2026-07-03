"""Shared helpers for API tests."""

from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image


def png_bytes(color: tuple[int, int, int] = (10, 120, 200), size=(64, 48)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def auth_headers(
    client: TestClient, email: str = "uploader@example.com", password: str = "s3curepass"
) -> dict[str, str]:
    client.post("/auth/register", json={"email": email, "password": password})
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
