"""Shared test fixtures.

Two safety rules hold this suite together:

1. Tests never run against production. APP_ENV must not be production, and
   the database's own label is checked before the first test.
2. Tests leave nothing behind. Each test runs inside one transaction that is
   rolled back afterwards, so the development database stays as it was.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import engine, get_db
from app.core.environment import assert_database_matches
from app.main import app
from app.modules.devices import router as devices_router


@pytest.fixture(scope="session", autouse=True)
def refuse_to_touch_production():
    if settings.app_env == "production":
        pytest.exit("Refusing to run the test suite with APP_ENV=production")
    with engine.connect() as conn:
        assert_database_matches(conn)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    # create_savepoint: the code under test calls db.commit() freely, which
    # here only releases a savepoint, so the outer rollback still undoes it.
    Session = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    session = Session()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def fake_broker(monkeypatch):
    """Keep tests off the real EMQX broker, and record what would have been done."""
    calls: list[tuple[str, str]] = []

    def recorder(action: str):
        def fake(device_id: str, secret: str | None = None) -> None:
            calls.append((action, device_id))

        return fake

    monkeypatch.setattr(devices_router, "create_device_login", recorder("create"))
    monkeypatch.setattr(devices_router, "replace_device_login", recorder("replace"))
    monkeypatch.setattr(devices_router, "delete_device_login", recorder("delete"))
    return calls


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    # Built without a context manager on purpose: entering one would run the
    # app's lifespan and start the real MQTT listener.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def account(client):
    """Register a fresh organisation and return its auth headers."""

    def _account(org_name: str = "Test Org") -> dict:
        email = f"test-{uuid.uuid4().hex[:10]}@example.com"
        response = client.post(
            "/auth/register", json={"email": email, "password": "correct-horse-battery", "org_name": org_name}
        )
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}

    return _account
