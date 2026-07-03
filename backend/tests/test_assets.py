"""Tests for asset upload, storage, and metadata extraction (Phase 3)."""

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.routes import assets as assets_route
from app.main import app
from app.services.storage import LocalStorage, get_storage


@pytest.fixture
def storage_dir(tmp_path: Path) -> Path:
    """Point the upload route at an isolated temp storage directory."""
    app.dependency_overrides[get_storage] = lambda: LocalStorage(tmp_path)
    try:
        yield tmp_path
    finally:
        app.dependency_overrides.pop(get_storage, None)


def _auth_headers(client: TestClient, email: str = "uploader@example.com") -> dict[str, str]:
    client.post("/auth/register", json={"email": email, "password": "s3curepass"})
    token = client.post(
        "/auth/login", data={"username": email, "password": "s3curepass"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _png_bytes(color: tuple[int, int, int] = (10, 120, 200), size=(64, 48)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def test_upload_png_creates_asset_with_thumbnail_and_colors(
    client: TestClient, storage_dir: Path
) -> None:
    headers = _auth_headers(client)
    resp = client.post(
        "/assets",
        headers=headers,
        files={"file": ("hero.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["original_filename"] == "hero.png"
    assert body["asset_type"] == "image"
    assert body["mime_type"] == "image/png"
    assert body["width"] == 64 and body["height"] == 48
    assert body["file_size"] > 0
    assert body["thumbnail_path"] is not None
    assert isinstance(body["dominant_colors"], list) and body["dominant_colors"]
    assert body["dominant_colors"][0].startswith("#")

    # Both the original and the thumbnail exist on disk.
    assert (storage_dir / body["file_path"]).exists()
    assert (storage_dir / body["thumbnail_path"]).exists()


def test_texture_named_image_is_classified_as_texture(
    client: TestClient, storage_dir: Path
) -> None:
    headers = _auth_headers(client)
    resp = client.post(
        "/assets",
        headers=headers,
        files={"file": ("brick_normal.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 201
    assert resp.json()["asset_type"] == "texture"


def test_upload_model_skips_thumbnail(client: TestClient, storage_dir: Path) -> None:
    headers = _auth_headers(client)
    resp = client.post(
        "/assets",
        headers=headers,
        files={"file": ("rock.glb", b"glTF\x02\x00\x00\x00fake-binary", "model/gltf-binary")},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["asset_type"] == "model_3d"
    assert body["thumbnail_path"] is None
    assert body["width"] is None
    assert body["dominant_colors"] is None
    assert (storage_dir / body["file_path"]).exists()


def test_upload_requires_authentication(client: TestClient, storage_dir: Path) -> None:
    resp = client.post("/assets", files={"file": ("hero.png", _png_bytes(), "image/png")})
    assert resp.status_code == 401


def test_upload_rejects_unsupported_type(client: TestClient, storage_dir: Path) -> None:
    headers = _auth_headers(client)
    resp = client.post(
        "/assets",
        headers=headers,
        files={"file": ("notes.txt", b"just text", "text/plain")},
    )
    assert resp.status_code == 415


def test_upload_rejects_oversized_file(
    client: TestClient, storage_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = _auth_headers(client)
    # Shrink the limit for this test so we don't have to build a 50 MiB payload.
    monkeypatch.setattr(assets_route.settings, "max_upload_bytes", 16)
    resp = client.post(
        "/assets",
        headers=headers,
        files={"file": ("hero.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 413
