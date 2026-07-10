"""Tests for the read-only guest account ('Continue as guest')."""

from pathlib import Path

from fastapi.testclient import TestClient

from tests.helpers import auth_headers as _auth_headers
from tests.helpers import png_bytes as _png_bytes
from tests.helpers import upload as _upload


def _guest_headers(client: TestClient) -> dict[str, str]:
    token = client.post("/auth/guest").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _public_asset(client: TestClient, owner: dict[str, str]) -> dict:
    asset = _upload(client, owner)
    client.patch(f"/assets/{asset['id']}", headers=owner, json={"is_public": True})
    return asset


def test_guest_login_marks_user_as_guest(client: TestClient) -> None:
    headers = _guest_headers(client)
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["is_guest"] is True


def test_guest_login_is_a_shared_account(client: TestClient) -> None:
    first = client.post("/auth/guest").json()
    second = client.post("/auth/guest").json()
    id1 = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {first['access_token']}"}
    ).json()["id"]
    id2 = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {second['access_token']}"}
    ).json()["id"]
    assert id1 == id2


def test_guest_can_browse_and_download_public_assets(
    client: TestClient, storage_dir: Path
) -> None:
    alice = _auth_headers(client, "alice")
    asset = _public_asset(client, alice)
    guest = _guest_headers(client)

    # Sees it in the public scope...
    body = client.get("/assets", headers=guest, params={"scope": "public"}).json()
    assert asset["id"] in {item["id"] for item in body["items"]}
    # ...can open its details...
    assert client.get(f"/assets/{asset['id']}", headers=guest).status_code == 200
    # ...and can download the original.
    dl = client.get(f"/assets/{asset['id']}/download", headers=guest)
    assert dl.status_code == 200 and dl.content


def test_guest_cannot_see_private_assets(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    private = _upload(client, alice)  # stays private
    guest = _guest_headers(client)
    assert client.get(f"/assets/{private['id']}", headers=guest).status_code == 404


def test_guest_can_read_comments_but_not_post(
    client: TestClient, storage_dir: Path
) -> None:
    alice = _auth_headers(client, "alice")
    asset = _public_asset(client, alice)
    client.post(
        f"/assets/{asset['id']}/comments", headers=alice, json={"body": "nice one"}
    )
    guest = _guest_headers(client)

    # Reading the thread is fine.
    read = client.get(f"/assets/{asset['id']}/comments", headers=guest)
    assert read.status_code == 200 and len(read.json()) == 1
    # Posting is refused.
    assert client.post(
        f"/assets/{asset['id']}/comments", headers=guest, json={"body": "hi"}
    ).status_code == 403


def test_guest_writes_are_all_forbidden(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    asset = _public_asset(client, alice)
    guest = _guest_headers(client)

    # Upload
    assert client.post(
        "/assets", headers=guest, files={"file": ("g.png", _png_bytes(), "image/png")}
    ).status_code == 403
    # Like
    assert client.post(f"/assets/{asset['id']}/like", headers=guest).status_code == 403
    # Edit
    assert client.patch(
        f"/assets/{asset['id']}", headers=guest, json={"description": "x"}
    ).status_code == 403
    # Delete
    assert client.delete(f"/assets/{asset['id']}", headers=guest).status_code == 403
    # Create a folder / category / tag
    assert client.post("/folders", headers=guest, json={"name": "f"}).status_code == 403
    assert client.post("/categories", headers=guest, json={"name": "c"}).status_code == 403
    assert client.post("/tags", headers=guest, json={"name": "t"}).status_code == 403
