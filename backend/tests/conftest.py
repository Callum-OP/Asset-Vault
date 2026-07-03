"""Shared pytest fixtures.

``db_session`` binds a Session to a single connection wrapped in an outer
transaction that is rolled back after each test. ``join_transaction_mode``
turns the endpoint's ``commit()`` into a SAVEPOINT release, so writes are
visible within the test but never persisted to the real database.
"""

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import engine, get_db
from app.main import app
from app.services.storage import LocalStorage, get_storage


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient whose ``get_db`` yields the rollback-scoped session."""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def storage_dir(tmp_path: Path) -> Generator[Path, None, None]:
    """Point the upload route at an isolated temp storage directory."""
    app.dependency_overrides[get_storage] = lambda: LocalStorage(tmp_path)
    try:
        yield tmp_path
    finally:
        app.dependency_overrides.pop(get_storage, None)
