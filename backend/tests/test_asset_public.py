"""Tests for public/private assets and the 'Others' assets' view (Phase 11)."""

from pathlib import Path

from fastapi.testclient import TestClient

from tests.helpers import auth_headers as _auth_headers
from tests.helpers import png_bytes as _png_bytes
from tests.helpers import upload as _upload


def test_assets_are_private_by_default(client: TestClient, storage_dir: Path) -> None:
    headers = _auth_headers(client)
    asset = _upload(client, headers)
    assert asset["is_public"] is False
    assert "owner_id" in asset


def test_owner_can_toggle_public(client: TestClient, storage_dir: Path) -> None:
    headers = _auth_headers(client)
    asset = _upload(client, headers)
    resp = client.patch(
        f"/assets/{asset['id']}", headers=headers, json={"is_public": True}
    )
    assert resp.status_code == 200
    assert resp.json()["is_public"] is True


def test_public_scope_shows_all_public_assets(
    client: TestClient, storage_dir: Path
) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")

    shared = _upload(client, alice, name="shared.png")
    private = _upload(client, alice, name="private.png")  # stays private
    client.patch(f"/assets/{shared['id']}", headers=alice, json={"is_public": True})

    # Bob sees Alice's public asset (but never her private one) under scope=public.
    body = client.get("/assets", headers=bob, params={"scope": "public"}).json()
    ids = {item["id"] for item in body["items"]}
    assert shared["id"] in ids
    assert private["id"] not in ids

    # scope=public also includes the viewer's OWN public assets, so they can
    # confirm an asset went public.
    bob_pub = _upload(client, bob, name="bob-pub.png")
    client.patch(f"/assets/{bob_pub['id']}", headers=bob, json={"is_public": True})
    body = client.get("/assets", headers=bob, params={"scope": "public"}).json()
    ids = {item["id"] for item in body["items"]}
    assert {shared["id"], bob_pub["id"]} <= ids


def test_mine_scope_excludes_public_others(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    shared = _upload(client, alice)
    client.patch(f"/assets/{shared['id']}", headers=alice, json={"is_public": True})

    # Bob's default (scope=mine) listing must not include Alice's public asset.
    assert client.get("/assets", headers=bob).json()["total"] == 0


def test_get_public_asset_across_users(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _upload(client, alice)

    # Private: Bob gets 404.
    assert client.get(f"/assets/{asset['id']}", headers=bob).status_code == 404
    # Made public: Bob can now read it.
    client.patch(f"/assets/{asset['id']}", headers=alice, json={"is_public": True})
    resp = client.get(f"/assets/{asset['id']}", headers=bob)
    assert resp.status_code == 200
    assert resp.json()["owner_id"] != bob and resp.json()["is_public"] is True


def test_non_owner_cannot_edit_or_delete_public_asset(
    client: TestClient, storage_dir: Path
) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _upload(client, alice)
    client.patch(f"/assets/{asset['id']}", headers=alice, json={"is_public": True})

    # Readable, but not writable/deletable by Bob.
    assert client.patch(
        f"/assets/{asset['id']}", headers=bob, json={"description": "hacked"}
    ).status_code == 404
    assert client.delete(f"/assets/{asset['id']}", headers=bob).status_code == 404


def test_thumbnail_upload_extracts_dominant_colors(
    client: TestClient, storage_dir: Path
) -> None:
    """A captured screenshot for a 3D model should yield dominant colours."""
    headers = _auth_headers(client)
    glb = client.post(
        "/assets",
        headers=headers,
        files={"file": ("m.glb", b"glTF\x02\x00\x00\x00binary", "model/gltf-binary")},
    ).json()
    assert glb["dominant_colors"] is None

    resp = client.put(
        f"/assets/{glb['id']}/thumbnail",
        headers=headers,
        files={"file": ("snap.png", _png_bytes(color=(200, 30, 30)), "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["dominant_colors"], list) and body["dominant_colors"]
    assert body["dominant_colors"][0].startswith("#")
    # Dimensions come from the screenshot too when the model had none.
    assert body["width"] == 64 and body["height"] == 48
