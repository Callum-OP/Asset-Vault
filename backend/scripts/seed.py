"""Seed the database with demo data for LocalAsset Vault.

Creates two users so the public/private ("Others' assets") feature is easy to
try out:

* ``demo@example.com`` / ``demopass1`` — your main account, with folders,
  categories, tags, and a handful of private assets.
* ``friend@example.com`` / ``friendpass1`` — a second account owning a couple
  of *public* assets, which show up under "Others' assets" when you log in as
  the demo user.

Assets are generated as solid-colour PNGs on the fly (no sample files needed),
run through the real media + storage services so thumbnails and dominant colours
are produced exactly as a normal upload would.

Run from the ``backend`` directory:

    uv run python -m scripts.seed          # create demo data (idempotent)
    uv run python -m scripts.seed --reset  # delete the demo users first, then reseed
"""

from __future__ import annotations

import argparse
import io

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Asset, AssetLike, Category, Comment, Folder, Tag, User
from app.services import media
from app.services.storage import get_storage

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demopass1"
FRIEND_EMAIL = "friend@example.com"
FRIEND_PASSWORD = "friendpass1"


def _png(color: tuple[int, int, int], size: tuple[int, int] = (512, 512)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def _get_or_create_user(db: Session, email: str, password: str) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == email))
    if user:
        return user, False
    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    db.flush()
    return user, True


def _make_asset(
    db: Session,
    owner: User,
    name: str,
    color: tuple[int, int, int],
    *,
    folder: Folder | None = None,
    category: Category | None = None,
    tags: list[Tag] | None = None,
    is_public: bool = False,
) -> Asset:
    """Create one image asset from generated PNG bytes, like a real upload."""
    storage = get_storage()
    data = _png(color)
    stored_name, file_path = storage.save_file(data, ".png")
    width, height = media.extract_dimensions(data)
    thumbnail_path = storage.save_thumbnail(media.make_thumbnail(data), stored_name)
    dominant_colors = media.extract_dominant_colors(data)

    asset = Asset(
        owner_id=owner.id,
        original_filename=name,
        stored_filename=stored_name,
        file_path=file_path,
        file_size=len(data),
        mime_type="image/png",
        asset_type=media.AssetType.image,
        thumbnail_path=thumbnail_path,
        width=width,
        height=height,
        dominant_colors=dominant_colors,
        is_public=is_public,
        folder_id=folder.id if folder else None,
        category_id=category.id if category else None,
        tags=tags or [],
    )
    db.add(asset)
    return asset


def _reset(db: Session) -> None:
    """Delete the demo users (assets/folders/etc. cascade) and their files."""
    storage = get_storage()
    users = db.scalars(
        select(User).where(User.email.in_([DEMO_EMAIL, FRIEND_EMAIL]))
    ).all()
    for user in users:
        for asset in list(user.assets):
            storage.delete(asset.file_path)
            storage.delete(asset.thumbnail_path)
        db.delete(user)
    db.commit()
    print(f"Reset: removed {len(users)} demo user(s) and their assets.")


def seed(db: Session) -> None:
    demo, created = _get_or_create_user(db, DEMO_EMAIL, DEMO_PASSWORD)
    if not created:
        print(
            f"User {DEMO_EMAIL} already exists — skipping seed. "
            "Use --reset to start fresh."
        )
        return

    friend, _ = _get_or_create_user(db, FRIEND_EMAIL, FRIEND_PASSWORD)

    # Folders (nested) for the demo user.
    characters = Folder(owner_id=demo.id, name="Characters")
    environments = Folder(owner_id=demo.id, name="Environments")
    db.add_all([characters, environments])
    db.flush()
    props = Folder(owner_id=demo.id, name="Props", parent_id=environments.id)
    db.add(props)
    db.flush()

    # Categories & tags.
    concept = Category(owner_id=demo.id, name="Concept")
    final = Category(owner_id=demo.id, name="Final")
    db.add_all([concept, final])
    low_poly = Tag(owner_id=demo.id, name="low-poly")
    stylized = Tag(owner_id=demo.id, name="stylized")
    wip = Tag(owner_id=demo.id, name="wip")
    db.add_all([low_poly, stylized, wip])
    db.flush()

    # Demo user's private assets.
    _make_asset(db, demo, "hero-red.png", (200, 60, 60),
                folder=characters, category=final, tags=[stylized])
    _make_asset(db, demo, "hero-blue.png", (60, 90, 200),
                folder=characters, category=concept, tags=[wip])
    _make_asset(db, demo, "forest-green.png", (40, 150, 70),
                folder=environments, category=final, tags=[low_poly])
    _make_asset(db, demo, "crate-brown.png", (140, 100, 50),
                folder=props, tags=[low_poly, stylized])
    _make_asset(db, demo, "unfiled-gray.png", (130, 130, 130))

    # Friend's public assets — these appear under the demo user's "Others' assets".
    purple = _make_asset(db, friend, "shared-purple.png", (150, 70, 190), is_public=True)
    teal = _make_asset(db, friend, "shared-teal.png", (40, 170, 170), is_public=True)
    # ...and one private asset that must NOT be visible to the demo user.
    _make_asset(db, friend, "friend-secret.png", (20, 20, 20))
    db.flush()

    # Social activity on the public assets: likes + comments across both users.
    demo_comment = Comment(
        asset_id=purple.id, user_id=demo.id, body="Gorgeous colour — love this!"
    )
    db.add_all([
        AssetLike(asset_id=purple.id, user_id=demo.id),
        AssetLike(asset_id=teal.id, user_id=demo.id),
        AssetLike(asset_id=purple.id, user_id=friend.id),  # you can like your own
        demo_comment,
        Comment(asset_id=teal.id, user_id=demo.id, body="Would pair well with the forest set."),
    ])
    db.flush()
    # A threaded reply from the owner back to the demo user's comment.
    db.add(
        Comment(
            asset_id=purple.id,
            user_id=friend.id,
            parent_id=demo_comment.id,
            body="Thanks! More coming soon.",
        )
    )

    db.commit()
    print("Seeded demo data:")
    print(f"  {DEMO_EMAIL} / {DEMO_PASSWORD}  (5 private assets, folders, tags)")
    print(f"  {FRIEND_EMAIL} / {FRIEND_PASSWORD}  (2 public + 1 private asset)")
    print("  + likes & comments on the public assets to demo the social layer")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data.")
    parser.add_argument(
        "--reset", action="store_true", help="Delete demo users before seeding."
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.reset:
            _reset(db)
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
