"""Tests for tags, categories, tag attach/detach, batch edit, and cascades."""

from pathlib import Path

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, upload


# --- Category & Tag CRUD -------------------------------------------------


def test_category_crud_and_duplicate(client: TestClient) -> None:
    h = auth_headers(client)
    created = client.post("/categories", headers=h, json={"name": "Environments"})
    assert created.status_code == 201
    cid = created.json()["id"]

    assert client.post("/categories", headers=h, json={"name": "Environments"}).status_code == 409

    listed = client.get("/categories", headers=h).json()
    assert [c["name"] for c in listed] == ["Environments"]

    renamed = client.patch(f"/categories/{cid}", headers=h, json={"name": "Props"})
    assert renamed.status_code == 200 and renamed.json()["name"] == "Props"

    assert client.delete(f"/categories/{cid}", headers=h).status_code == 204
    assert client.get("/categories", headers=h).json() == []


def test_tag_crud_and_duplicate(client: TestClient) -> None:
    h = auth_headers(client)
    created = client.post("/tags", headers=h, json={"name": "low-poly"})
    assert created.status_code == 201
    tid = created.json()["id"]

    assert client.post("/tags", headers=h, json={"name": "low-poly"}).status_code == 409

    renamed = client.patch(f"/tags/{tid}", headers=h, json={"name": "lowpoly"})
    assert renamed.status_code == 200 and renamed.json()["name"] == "lowpoly"

    assert client.delete(f"/tags/{tid}", headers=h).status_code == 204


def test_taxonomy_is_owner_scoped(client: TestClient) -> None:
    alice = auth_headers(client, "alice")
    bob = auth_headers(client, "bob")
    tid = client.post("/tags", headers=alice, json={"name": "secret"}).json()["id"]

    assert client.get("/tags", headers=bob).json() == []
    assert client.patch(f"/tags/{tid}", headers=bob, json={"name": "x"}).status_code == 404
    assert client.delete(f"/tags/{tid}", headers=bob).status_code == 404


# --- Attach / detach tags on an asset ------------------------------------


def test_attach_and_detach_tags(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    asset = upload(client, h)
    t1 = client.post("/tags", headers=h, json={"name": "a"}).json()["id"]
    t2 = client.post("/tags", headers=h, json={"name": "b"}).json()["id"]

    resp = client.post(f"/assets/{asset['id']}/tags", headers=h, json={"tag_ids": [t1, t2]})
    assert resp.status_code == 200
    assert {t["name"] for t in resp.json()["tags"]} == {"a", "b"}

    # Idempotent: re-adding the same tag does not duplicate.
    again = client.post(f"/assets/{asset['id']}/tags", headers=h, json={"tag_ids": [t1]})
    assert len(again.json()["tags"]) == 2

    detached = client.delete(f"/assets/{asset['id']}/tags/{t1}", headers=h)
    assert detached.status_code == 200
    assert {t["name"] for t in detached.json()["tags"]} == {"b"}


def test_attach_rejects_unowned_tag(client: TestClient, storage_dir: Path) -> None:
    alice = auth_headers(client, "alice")
    bob = auth_headers(client, "bob")
    asset = upload(client, alice)
    bob_tag = client.post("/tags", headers=bob, json={"name": "bobs"}).json()["id"]

    resp = client.post(f"/assets/{asset['id']}/tags", headers=alice, json={"tag_ids": [bob_tag]})
    assert resp.status_code == 400


def test_asset_read_includes_category(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    asset = upload(client, h)
    cid = client.post("/categories", headers=h, json={"name": "Props"}).json()["id"]
    client.patch(f"/assets/{asset['id']}", headers=h, json={"category_id": cid})

    body = client.get(f"/assets/{asset['id']}", headers=h).json()
    assert body["category"]["name"] == "Props"


# --- Batch edit ----------------------------------------------------------


def test_batch_add_tags_and_set_category(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    a1 = upload(client, h, name="a1.png")
    a2 = upload(client, h, name="a2.png")
    tag = client.post("/tags", headers=h, json={"name": "shared"}).json()["id"]
    cid = client.post("/categories", headers=h, json={"name": "Batch"}).json()["id"]

    resp = client.post(
        "/assets/batch",
        headers=h,
        json={"asset_ids": [a1["id"], a2["id"]], "add_tag_ids": [tag], "category_id": cid, "rating": 4},
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 2

    for a in (a1, a2):
        body = client.get(f"/assets/{a['id']}", headers=h).json()
        assert {t["name"] for t in body["tags"]} == {"shared"}
        assert body["category"]["name"] == "Batch"
        assert body["rating"] == 4


def test_batch_rejects_unowned_asset(client: TestClient, storage_dir: Path) -> None:
    alice = auth_headers(client, "alice")
    bob = auth_headers(client, "bob")
    a_alice = upload(client, alice, name="alice.png")
    a_bob = upload(client, bob, name="bob.png")

    resp = client.post(
        "/assets/batch",
        headers=alice,
        json={"asset_ids": [a_alice["id"], a_bob["id"]], "rating": 3},
    )
    assert resp.status_code == 404


# --- Cascades ------------------------------------------------------------


def test_deleting_category_clears_it_from_assets(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    asset = upload(client, h)
    cid = client.post("/categories", headers=h, json={"name": "Temp"}).json()["id"]
    client.patch(f"/assets/{asset['id']}", headers=h, json={"category_id": cid})

    assert client.delete(f"/categories/{cid}", headers=h).status_code == 204
    body = client.get(f"/assets/{asset['id']}", headers=h).json()
    assert body["category_id"] is None
    assert body["category"] is None


def test_deleting_tag_removes_it_from_assets(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    asset = upload(client, h)
    tid = client.post("/tags", headers=h, json={"name": "temp"}).json()["id"]
    client.post(f"/assets/{asset['id']}/tags", headers=h, json={"tag_ids": [tid]})

    assert client.delete(f"/tags/{tid}", headers=h).status_code == 204
    body = client.get(f"/assets/{asset['id']}", headers=h).json()
    assert body["tags"] == []
