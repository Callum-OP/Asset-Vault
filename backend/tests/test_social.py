"""Tests for likes & comments on public assets (Phase 12 — social layer)."""

from pathlib import Path

from fastapi.testclient import TestClient

from tests.helpers import auth_headers as _auth_headers
from tests.helpers import upload as _upload


def _public_asset(client: TestClient, owner: dict[str, str], name: str = "shared.png") -> dict:
    asset = _upload(client, owner, name=name)
    client.patch(f"/assets/{asset['id']}", headers=owner, json={"is_public": True})
    return asset


def test_like_and_unlike_public_asset(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)

    resp = client.post(f"/assets/{asset['id']}/like", headers=bob)
    assert resp.status_code == 200
    assert resp.json() == {"liked_by_me": True, "like_count": 1}

    # Liking again is idempotent — still one like.
    assert client.post(f"/assets/{asset['id']}/like", headers=bob).json()["like_count"] == 1

    # The owner can like their own public asset too.
    assert client.post(f"/assets/{asset['id']}/like", headers=alice).json()["like_count"] == 2

    resp = client.delete(f"/assets/{asset['id']}/like", headers=bob)
    assert resp.status_code == 200
    assert resp.json() == {"liked_by_me": False, "like_count": 1}


def test_like_counts_surface_on_asset_read(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)
    client.post(f"/assets/{asset['id']}/like", headers=bob)

    # Bob sees his own like reflected; counts appear in list + detail.
    detail = client.get(f"/assets/{asset['id']}", headers=bob).json()
    assert detail["like_count"] == 1
    assert detail["liked_by_me"] is True

    listing = client.get("/assets", headers=bob, params={"scope": "public"}).json()
    item = next(i for i in listing["items"] if i["id"] == asset["id"])
    assert item["like_count"] == 1 and item["liked_by_me"] is True

    # Alice hasn't liked it — liked_by_me is False for her.
    assert client.get(f"/assets/{asset['id']}", headers=alice).json()["liked_by_me"] is False


def test_cannot_like_private_asset(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    asset = _upload(client, alice)  # private
    # Even the owner can't like a private asset — it's not a social surface yet.
    assert client.post(f"/assets/{asset['id']}/like", headers=alice).status_code == 403


def test_cannot_like_others_private_asset(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _upload(client, alice)  # private
    # Bob can't even see it — 404, not 403 (don't leak existence).
    assert client.post(f"/assets/{asset['id']}/like", headers=bob).status_code == 404


def test_add_list_and_delete_comments(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)

    resp = client.post(
        f"/assets/{asset['id']}/comments", headers=bob, json={"body": "Love this!"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["body"] == "Love this!"
    assert body["author_name"]  # a display name, not empty
    comment_id = body["id"]

    client.post(f"/assets/{asset['id']}/comments", headers=alice, json={"body": "Thanks!"})

    comments = client.get(f"/assets/{asset['id']}/comments", headers=alice).json()
    assert [c["body"] for c in comments] == ["Love this!", "Thanks!"]  # oldest first

    # comment_count surfaces on the asset read.
    assert client.get(f"/assets/{asset['id']}", headers=alice).json()["comment_count"] == 2

    # Bob (the author) can delete his own comment.
    assert client.delete(
        f"/assets/{asset['id']}/comments/{comment_id}", headers=bob
    ).status_code == 204
    assert len(client.get(f"/assets/{asset['id']}/comments", headers=alice).json()) == 1


def test_asset_owner_can_moderate_comments(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)
    comment = client.post(
        f"/assets/{asset['id']}/comments", headers=bob, json={"body": "spam"}
    ).json()

    # Alice owns the asset, so she can delete Bob's comment.
    assert client.delete(
        f"/assets/{asset['id']}/comments/{comment['id']}", headers=alice
    ).status_code == 204


def test_non_author_non_owner_cannot_delete_comment(
    client: TestClient, storage_dir: Path
) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    carol = _auth_headers(client, "carol")
    asset = _public_asset(client, alice)
    comment = client.post(
        f"/assets/{asset['id']}/comments", headers=bob, json={"body": "hi"}
    ).json()

    # Carol is neither the author nor the asset owner.
    assert client.delete(
        f"/assets/{asset['id']}/comments/{comment['id']}", headers=carol
    ).status_code == 404


def test_reply_to_comment(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)

    top = client.post(
        f"/assets/{asset['id']}/comments", headers=bob, json={"body": "Nice!"}
    ).json()
    assert top["parent_id"] is None

    reply = client.post(
        f"/assets/{asset['id']}/comments",
        headers=alice,
        json={"body": "Thanks Bob", "parent_id": top["id"]},
    )
    assert reply.status_code == 201
    assert reply.json()["parent_id"] == top["id"]

    # Both the comment and its reply come back in the flat thread list.
    comments = client.get(f"/assets/{asset['id']}/comments", headers=alice).json()
    assert len(comments) == 2
    # comment_count includes replies.
    assert client.get(f"/assets/{asset['id']}", headers=alice).json()["comment_count"] == 2


def test_can_reply_to_a_reply(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    asset = _public_asset(client, alice)
    top = client.post(
        f"/assets/{asset['id']}/comments", headers=alice, json={"body": "root"}
    ).json()
    reply = client.post(
        f"/assets/{asset['id']}/comments",
        headers=alice,
        json={"body": "reply", "parent_id": top["id"]},
    ).json()

    # Nesting is unlimited — you can reply to a reply.
    resp = client.post(
        f"/assets/{asset['id']}/comments",
        headers=alice,
        json={"body": "nested", "parent_id": reply["id"]},
    )
    assert resp.status_code == 201
    assert resp.json()["parent_id"] == reply["id"]


def test_reply_parent_must_belong_to_asset(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    a1 = _public_asset(client, alice, name="a1.png")
    a2 = _public_asset(client, alice, name="a2.png")
    top = client.post(
        f"/assets/{a1['id']}/comments", headers=alice, json={"body": "on a1"}
    ).json()

    # Parent belongs to a different asset — rejected.
    resp = client.post(
        f"/assets/{a2['id']}/comments",
        headers=alice,
        json={"body": "wrong asset", "parent_id": top["id"]},
    )
    assert resp.status_code == 400


def test_deleting_comment_removes_its_replies(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)
    top = client.post(
        f"/assets/{asset['id']}/comments", headers=alice, json={"body": "root"}
    ).json()
    client.post(
        f"/assets/{asset['id']}/comments",
        headers=bob,
        json={"body": "a reply", "parent_id": top["id"]},
    )
    assert len(client.get(f"/assets/{asset['id']}/comments", headers=alice).json()) == 2

    # Deleting the top-level comment cascades to its reply.
    assert client.delete(
        f"/assets/{asset['id']}/comments/{top['id']}", headers=alice
    ).status_code == 204
    assert client.get(f"/assets/{asset['id']}/comments", headers=alice).json() == []


def test_owner_name_surfaces_on_asset(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    bob = _auth_headers(client, "bob")
    asset = _public_asset(client, alice)
    # Bob sees who shared it (a display name derived from the owner's email).
    detail = client.get(f"/assets/{asset['id']}", headers=bob).json()
    assert detail["owner_name"]
    assert "@" not in detail["owner_name"]  # never the raw email


def test_empty_comment_rejected(client: TestClient, storage_dir: Path) -> None:
    alice = _auth_headers(client, "alice")
    asset = _public_asset(client, alice)
    assert client.post(
        f"/assets/{asset['id']}/comments", headers=alice, json={"body": "   "}
    ).status_code == 422
    assert client.post(
        f"/assets/{asset['id']}/comments", headers=alice, json={"body": ""}
    ).status_code == 422
