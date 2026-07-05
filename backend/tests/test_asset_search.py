"""Tests for asset search, filtering, and sorting (Phase 5)."""

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Asset, Category, Tag
from tests.helpers import auth_headers, upload

RED = (200, 40, 60)
BLUE = (30, 60, 200)


def _list(client: TestClient, headers: dict[str, str], **params) -> dict:
    resp = client.get("/assets", headers=headers, params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _upload_glb(client: TestClient, headers: dict[str, str], name: str = "model.glb") -> dict:
    resp = client.post(
        "/assets",
        headers=headers,
        files={"file": (name, b"glTF\x02\x00\x00\x00binary", "model/gltf-binary")},
    )
    assert resp.status_code == 201
    return resp.json()


def test_filter_by_type(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    upload(client, h, name="pic.png")
    _upload_glb(client, h)

    assert _list(client, h, type="image")["total"] == 1
    assert _list(client, h, type="model_3d")["total"] == 1
    assert _list(client, h, type="video")["total"] == 0


def test_search_q_matches_filename_and_description(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    sunset = upload(client, h, name="sunset_beach.png")
    other = upload(client, h, name="random.png")
    client.patch(f"/assets/{other['id']}", headers=h, json={"description": "a lovely sunset scene"})

    ids = {item["id"] for item in _list(client, h, q="sunset")["items"]}
    assert ids == {sunset["id"], other["id"]}
    assert _list(client, h, q="nomatch")["total"] == 0


def test_filter_by_color_bucket(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    red = upload(client, h, name="red.png", color=RED)
    blue = upload(client, h, name="blue.png", color=BLUE)

    red_ids = {i["id"] for i in _list(client, h, color="red")["items"]}
    blue_ids = {i["id"] for i in _list(client, h, color="blue")["items"]}
    assert red_ids == {red["id"]}
    assert blue_ids == {blue["id"]}
    assert _list(client, h, color="green")["total"] == 0


def test_invalid_color_returns_422(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    upload(client, h)
    resp = client.get("/assets", headers=h, params={"color": "chartreusey"})
    assert resp.status_code == 422


def test_filter_by_category_name(client: TestClient, db_session: Session, storage_dir: Path) -> None:
    h = auth_headers(client, "cat")
    a1 = upload(client, h, name="in_cat.png")
    upload(client, h, name="no_cat.png")

    user_id = client.get("/auth/me", headers=h).json()["id"]
    category = Category(name="Environments", owner_id=user_id)
    db_session.add(category)
    db_session.flush()
    asset = db_session.get(Asset, a1["id"])
    asset.category_id = category.id
    db_session.commit()

    # Case-insensitive match on category name.
    body = _list(client, h, category="environments")
    assert body["total"] == 1
    assert body["items"][0]["id"] == a1["id"]


def test_filter_by_tag_requires_all(client: TestClient, db_session: Session, storage_dir: Path) -> None:
    h = auth_headers(client, "tags")
    both = upload(client, h, name="both.png")
    one = upload(client, h, name="one.png")

    user_id = client.get("/auth/me", headers=h).json()["id"]
    low_poly = Tag(name="low-poly", owner_id=user_id)
    stylized = Tag(name="stylized", owner_id=user_id)
    db_session.add_all([low_poly, stylized])
    both_asset = db_session.get(Asset, both["id"])
    one_asset = db_session.get(Asset, one["id"])
    both_asset.tags.extend([low_poly, stylized])
    one_asset.tags.append(low_poly)
    db_session.commit()

    # Single tag matches both assets; requiring both tags narrows to one.
    assert _list(client, h, tag="low-poly")["total"] == 2
    both_body = _list(client, h, tag=["low-poly", "stylized"])
    assert both_body["total"] == 1
    assert both_body["items"][0]["id"] == both["id"]


def test_sort_by_likes(client: TestClient, storage_dir: Path) -> None:
    owner = auth_headers(client, "owner")
    liker = auth_headers(client, "liker")

    # Three public assets with 0, 1, and 2 likes respectively.
    zero = upload(client, owner, name="zero.png")
    one = upload(client, owner, name="one.png")
    two = upload(client, owner, name="two.png")
    for a in (zero, one, two):
        client.patch(f"/assets/{a['id']}", headers=owner, json={"is_public": True})
    client.post(f"/assets/{one['id']}/like", headers=owner)
    client.post(f"/assets/{two['id']}/like", headers=owner)
    client.post(f"/assets/{two['id']}/like", headers=liker)

    desc = [i["id"] for i in _list(client, owner, sort="likes", order="desc")["items"]]
    asc = [i["id"] for i in _list(client, owner, sort="likes", order="asc")["items"]]
    assert desc == [two["id"], one["id"], zero["id"]]
    assert asc == [zero["id"], one["id"], two["id"]]


def test_combined_filters(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    match = upload(client, h, name="hero_red.png", color=RED)
    # Right type + query but wrong colour → excluded.
    upload(client, h, name="hero_blue.png", color=BLUE)

    body = _list(client, h, type="image", color="red", q="hero")
    assert body["total"] == 1
    assert body["items"][0]["id"] == match["id"]
