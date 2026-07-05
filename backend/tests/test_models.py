"""Round-trip tests for the SQLAlchemy models.

Each test runs inside a transaction that is rolled back afterwards, so the
tests exercise the real ``assetvault`` schema without leaving residue.
"""

from collections.abc import Generator

import pytest
from sqlalchemy.orm import Session

from app.core.database import engine
from app.models import Asset, AssetType, Category, Tag, User


@pytest.fixture
def db() -> Generator[Session, None, None]:
    """Yield a session wrapped in a transaction that is always rolled back."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


def test_asset_round_trip_with_relationships(db: Session) -> None:
    user = User(email="roundtrip@example.com", hashed_password="not-a-real-hash")
    category = Category(name="Environments", owner=user)
    tag_a = Tag(name="low-poly", owner=user)
    tag_b = Tag(name="stylized", owner=user)

    asset = Asset(
        owner=user,
        category=category,
        original_filename="rock.glb",
        stored_filename="abc123.glb",
        file_path="storage/abc123.glb",
        file_size=204800,
        mime_type="model/gltf-binary",
        asset_type=AssetType.model_3d,
        dominant_colors=["#8a8a8a", "#5c5c5c"],
        description="A mossy boulder",
        tags=[tag_a, tag_b],
    )

    db.add(asset)
    db.flush()  # assign PKs and run FKs without committing
    asset_id = asset.id
    db.expire_all()  # force a fresh read back from the database

    fetched = db.get(Asset, asset_id)
    assert fetched is not None
    assert fetched.original_filename == "rock.glb"
    assert fetched.asset_type is AssetType.model_3d
    assert fetched.dominant_colors == ["#8a8a8a", "#5c5c5c"]
    assert fetched.created_at is not None  # server_default populated
    assert fetched.updated_at is not None

    # Relationships resolve in both directions.
    assert fetched.owner.email == "roundtrip@example.com"
    assert fetched.category.name == "Environments"
    assert {tag.name for tag in fetched.tags} == {"low-poly", "stylized"}
    assert fetched in fetched.owner.assets
    assert fetched in tag_a.assets


def test_asset_type_defaults_to_other(db: Session) -> None:
    user = User(email="defaults@example.com", hashed_password="x")
    asset = Asset(
        owner=user,
        original_filename="mystery.bin",
        stored_filename="def456.bin",
        file_path="storage/def456.bin",
        file_size=10,
        mime_type="application/octet-stream",
    )
    db.add(asset)
    db.flush()
    db.refresh(asset)
    assert asset.asset_type is AssetType.other
