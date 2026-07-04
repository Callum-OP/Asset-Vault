"""Tests for folders: CRUD, nesting, move/cycle guards, filtering, cascades."""

from pathlib import Path

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, upload


def _mkfolder(client: TestClient, h: dict[str, str], name: str, parent_id=None) -> dict:
    body = {"name": name}
    if parent_id is not None:
        body["parent_id"] = parent_id
    resp = client.post("/folders", headers=h, json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- CRUD & nesting ------------------------------------------------------


def test_create_nested_folders_and_list_counts(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    project = _mkfolder(client, h, "Acme Rebrand")
    refs = _mkfolder(client, h, "references", parent_id=project["id"])

    assert refs["parent_id"] == project["id"]

    asset = upload(client, h)
    client.patch(f"/assets/{asset['id']}", headers=h, json={"folder_id": refs["id"]})

    listed = client.get("/folders", headers=h).json()
    by_id = {f["id"]: f for f in listed}
    assert by_id[project["id"]]["asset_count"] == 0
    assert by_id[refs["id"]]["asset_count"] == 1


def test_duplicate_sibling_name_rejected_but_allowed_in_different_parents(
    client: TestClient,
) -> None:
    h = auth_headers(client)
    a = _mkfolder(client, h, "Client Work")
    b = _mkfolder(client, h, "Personal")

    # Same name under two different parents is fine.
    _mkfolder(client, h, "drafts", parent_id=a["id"])
    _mkfolder(client, h, "drafts", parent_id=b["id"])

    # Duplicate within the same parent is a conflict.
    dup = client.post("/folders", headers=h, json={"name": "drafts", "parent_id": a["id"]})
    assert dup.status_code == 409

    # Duplicate at the root is also a conflict.
    assert client.post("/folders", headers=h, json={"name": "Client Work"}).status_code == 409


def test_rename_and_move_folder(client: TestClient) -> None:
    h = auth_headers(client)
    home = _mkfolder(client, h, "Home")
    child = _mkfolder(client, h, "child")

    renamed = client.patch(f"/folders/{child['id']}", headers=h, json={"name": "renamed"})
    assert renamed.status_code == 200 and renamed.json()["name"] == "renamed"

    moved = client.patch(f"/folders/{child['id']}", headers=h, json={"parent_id": home["id"]})
    assert moved.status_code == 200 and moved.json()["parent_id"] == home["id"]

    # Move back to root with an explicit null parent.
    to_root = client.patch(f"/folders/{child['id']}", headers=h, json={"parent_id": None})
    assert to_root.status_code == 200 and to_root.json()["parent_id"] is None


# --- Cycle prevention ----------------------------------------------------


def test_cannot_move_folder_into_itself_or_descendant(client: TestClient) -> None:
    h = auth_headers(client)
    a = _mkfolder(client, h, "a")
    b = _mkfolder(client, h, "b", parent_id=a["id"])
    c = _mkfolder(client, h, "c", parent_id=b["id"])

    # Into itself.
    assert client.patch(f"/folders/{a['id']}", headers=h, json={"parent_id": a["id"]}).status_code == 400
    # Into a direct child.
    assert client.patch(f"/folders/{a['id']}", headers=h, json={"parent_id": b["id"]}).status_code == 400
    # Into a deeper descendant.
    assert client.patch(f"/folders/{a['id']}", headers=h, json={"parent_id": c["id"]}).status_code == 400


# --- Ownership scoping ---------------------------------------------------


def test_folders_are_owner_scoped(client: TestClient) -> None:
    alice = auth_headers(client, "alice")
    bob = auth_headers(client, "bob")
    fid = _mkfolder(client, alice, "secret")["id"]

    assert client.get("/folders", headers=bob).json() == []
    assert client.patch(f"/folders/{fid}", headers=bob, json={"name": "x"}).status_code == 404
    assert client.delete(f"/folders/{fid}", headers=bob).status_code == 404
    # Can't parent a new folder under someone else's folder.
    assert client.post("/folders", headers=bob, json={"name": "y", "parent_id": fid}).status_code == 404


def test_cannot_file_asset_into_unowned_folder(client: TestClient, storage_dir: Path) -> None:
    alice = auth_headers(client, "alice")
    bob = auth_headers(client, "bob")
    bob_folder = _mkfolder(client, bob, "bobs")["id"]
    asset = upload(client, alice)

    resp = client.patch(f"/assets/{asset['id']}", headers=alice, json={"folder_id": bob_folder})
    assert resp.status_code == 400


# --- Asset serialization & filtering -------------------------------------


def test_asset_read_includes_folder(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    folder = _mkfolder(client, h, "Textures")
    asset = upload(client, h)
    client.patch(f"/assets/{asset['id']}", headers=h, json={"folder_id": folder["id"]})

    body = client.get(f"/assets/{asset['id']}", headers=h).json()
    assert body["folder_id"] == folder["id"]
    assert body["folder"]["name"] == "Textures"


def test_filter_by_folder_and_subfolders(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    parent = _mkfolder(client, h, "Project")
    child = _mkfolder(client, h, "sub", parent_id=parent["id"])

    a_parent = upload(client, h, name="p.png")
    a_child = upload(client, h, name="c.png")
    upload(client, h, name="loose.png")  # stays unfiled
    client.patch(f"/assets/{a_parent['id']}", headers=h, json={"folder_id": parent["id"]})
    client.patch(f"/assets/{a_child['id']}", headers=h, json={"folder_id": child["id"]})

    # Just the parent folder (no descendants).
    direct = client.get("/assets", headers=h, params={"folder_id": parent["id"]}).json()
    assert {i["id"] for i in direct["items"]} == {a_parent["id"]}

    # Parent plus nested folders.
    deep = client.get(
        "/assets", headers=h, params={"folder_id": parent["id"], "include_subfolders": True}
    ).json()
    assert {i["id"] for i in deep["items"]} == {a_parent["id"], a_child["id"]}

    # Unfiled only.
    unfiled = client.get("/assets", headers=h, params={"unfiled": True}).json()
    assert {i["original_filename"] for i in unfiled["items"]} == {"loose.png"}


def test_batch_move_assets_to_folder(client: TestClient, storage_dir: Path) -> None:
    h = auth_headers(client)
    folder = _mkfolder(client, h, "Batch")
    a1 = upload(client, h, name="a1.png")
    a2 = upload(client, h, name="a2.png")

    resp = client.post(
        "/assets/batch",
        headers=h,
        json={"asset_ids": [a1["id"], a2["id"]], "folder_id": folder["id"]},
    )
    assert resp.status_code == 200 and resp.json()["updated"] == 2
    for a in (a1, a2):
        assert client.get(f"/assets/{a['id']}", headers=h).json()["folder_id"] == folder["id"]


# --- Cascade / unfiling on delete ----------------------------------------


def test_deleting_folder_unfiles_assets_and_removes_subfolders(
    client: TestClient, storage_dir: Path
) -> None:
    h = auth_headers(client)
    parent = _mkfolder(client, h, "Doomed")
    child = _mkfolder(client, h, "child", parent_id=parent["id"])
    asset = upload(client, h)
    client.patch(f"/assets/{asset['id']}", headers=h, json={"folder_id": child["id"]})

    assert client.delete(f"/folders/{parent['id']}", headers=h).status_code == 204

    # Subfolder is gone with the parent.
    remaining = {f["id"] for f in client.get("/folders", headers=h).json()}
    assert parent["id"] not in remaining and child["id"] not in remaining

    # The asset itself survives, now unfiled.
    body = client.get(f"/assets/{asset['id']}", headers=h).json()
    assert body["folder_id"] is None and body["folder"] is None
