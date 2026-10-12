"""One name per company, for products and for devices.

"Helmet", "helmet" and "  Helmet " would look identical in every list, so
they are one name. Another company's names are none of ours.
"""
import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.names import clean_name, name_key
from app.models.device import Device
from app.models.product import Product
from app.modules.devices import router as devices_router
from app.modules.products import router as products_router


def create_product(client, headers, name):
    return client.post("/products", headers=headers, json={"name": name, "category": "sensor"})


def create_device(client, headers, name):
    return client.post("/devices", headers=headers, json={"name": name, "category": "sensor"})


@pytest.mark.parametrize(
    "written, saved",
    [("Helmet", "Helmet"), ("  Helmet  ", "Helmet"), ("Smart   Safety\tHelmet", "Smart Safety Helmet")],
)
def test_a_name_is_saved_without_stray_spaces(written, saved):
    assert clean_name(written) == saved


def test_capitals_and_spaces_do_not_make_a_new_name():
    assert name_key("Smart Safety Helmet") == name_key("  smart   SAFETY helmet ")
    assert name_key("Helmet") != name_key("Helmet 2")


@pytest.mark.parametrize("second", ["Smart Safety Helmet", "smart safety helmet", "  Smart   Safety Helmet "])
def test_a_second_product_with_the_same_name_is_refused(client, account, second):
    headers = account()["headers"]
    assert create_product(client, headers, "Smart Safety Helmet").status_code == 201

    response = create_product(client, headers, second)

    assert response.status_code == 409
    assert "Smart Safety Helmet" in response.json()["detail"]
    assert len(client.get("/products", headers=headers).json()) == 1


@pytest.mark.parametrize("second", ["Helmet 1", "HELMET 1", " helmet  1 "])
def test_a_second_device_with_the_same_name_is_refused(client, account, fake_broker, second):
    headers = account()["headers"]
    assert create_device(client, headers, "Helmet 1").status_code == 201
    logins_before = len(fake_broker)

    response = create_device(client, headers, second)

    assert response.status_code == 409
    assert len(client.get("/devices", headers=headers).json()) == 1
    # A refused device must not leave a broker login behind.
    assert len(fake_broker) == logins_before


def test_a_different_name_is_fine(client, account):
    headers = account()["headers"]
    assert create_product(client, headers, "Helmet").status_code == 201
    assert create_product(client, headers, "Helmet 2").status_code == 201
    assert create_device(client, headers, "Helmet 1").status_code == 201
    assert create_device(client, headers, "Helmet 2").status_code == 201


def test_another_company_may_use_the_same_names(client, account):
    """Otherwise one customer could learn another's product names by trying them."""
    first, second = account("First Co")["headers"], account("Second Co")["headers"]
    assert create_product(client, first, "Helmet").status_code == 201
    assert create_device(client, first, "Helmet 1").status_code == 201

    assert create_product(client, second, "Helmet").status_code == 201
    assert create_device(client, second, "Helmet 1").status_code == 201


def test_a_product_and_a_device_may_share_a_name(client, account):
    """They are different kinds of thing, listed on different pages."""
    headers = account()["headers"]
    assert create_product(client, headers, "Helmet").status_code == 201
    assert create_device(client, headers, "Helmet").status_code == 201


def test_a_deleted_products_name_is_free_again(client, account):
    headers = account()["headers"]
    product = create_product(client, headers, "Helmet").json()
    assert client.delete(f"/products/{product['id']}", headers=headers).status_code == 204

    assert create_product(client, headers, "Helmet").status_code == 201


def test_a_name_of_only_spaces_is_refused(client, account):
    headers = account()["headers"]
    assert create_device(client, headers, "   ").status_code == 422
    assert create_product(client, headers, "   ").status_code == 422


def company_of(client, headers):
    return uuid.UUID(client.get("/auth/me", headers=headers).json()["org_id"])


@pytest.mark.parametrize(
    "model, extra",
    [(Product, {}), (Device, {"hashed_secret": "sha256$" + "0" * 64})],
)
def test_the_database_itself_refuses_a_duplicate(client, account, db_session, model, extra):
    """The final guard: rows written straight to the database, past every
    check the app makes, still cannot share a name within one company."""
    org_id = company_of(client, account()["headers"])
    db_session.add(model(org_id=org_id, name="Helmet", **extra))
    db_session.flush()

    db_session.add(model(org_id=org_id, name="HELMET", **extra))
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_the_database_lets_two_companies_share_a_name(client, account, db_session):
    for org_name in ("First Co", "Second Co"):
        db_session.add(Product(org_id=company_of(client, account(org_name)["headers"]), name="Helmet"))
    db_session.flush()


def test_two_requests_at_the_same_moment_get_a_clear_answer(client, account, monkeypatch):
    """Both pass the app's check; the database refuses the second. That must
    be "name taken" (409), never a server error (500)."""
    headers = account()["headers"]
    monkeypatch.setattr(products_router, "ensure_name_is_free", lambda *args, **kwargs: None)
    assert create_product(client, headers, "Helmet").status_code == 201

    response = create_product(client, headers, "helmet")

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]
    assert len(client.get("/products", headers=headers).json()) == 1


def test_a_device_refused_by_the_database_leaves_no_broker_login(client, account, fake_broker, monkeypatch):
    headers = account()["headers"]
    monkeypatch.setattr(devices_router, "ensure_name_is_free", lambda *args, **kwargs: None)
    assert create_device(client, headers, "Helmet 1").status_code == 201
    logins_before = list(fake_broker)

    response = create_device(client, headers, "HELMET 1")

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]
    assert len(client.get("/devices", headers=headers).json()) == 1
    # The database refuses before any broker login is made for the device.
    assert fake_broker == logins_before


def test_names_are_stored_clean(client, account):
    headers = account()["headers"]
    assert create_product(client, headers, "  Smart   Helmet ").json()["name"] == "Smart Helmet"
    assert create_device(client, headers, "  Helmet   7 ").json()["name"] == "Helmet 7"
