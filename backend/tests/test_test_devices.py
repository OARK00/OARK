"""Every device belongs to a product. A device added without one ("Test
device") goes into the company's "Test devices" product."""
import pytest
from sqlalchemy.exc import IntegrityError

from app.core.security import generate_device_secret, hash_device_secret
from app.models.device import Device
from app.models.product import Product
from app.modules.products.test_product import TEST_PRODUCT_NAME


def add_device(client, headers, name, **extra):
    response = client.post("/devices", json={"name": name, **extra}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def products_named(client, headers, name):
    return [p for p in client.get("/products", headers=headers).json() if p["name"].lower() == name.lower()]


def test_a_test_device_goes_into_the_test_devices_product(client, account):
    headers = account()["headers"]

    device = add_device(client, headers, "Bench board", category="controller")

    [product] = products_named(client, headers, TEST_PRODUCT_NAME)
    assert device["product_id"] == product["id"]
    # It keeps the category it was given, for its icon.
    assert device["category"] == "controller"


def test_all_test_devices_share_one_product(client, account):
    headers = account()["headers"]

    first = add_device(client, headers, "Bench board 1")
    second = add_device(client, headers, "Bench board 2")

    assert first["product_id"] == second["product_id"]
    assert len(products_named(client, headers, TEST_PRODUCT_NAME)) == 1


def test_a_product_already_called_test_devices_is_reused(client, account):
    headers = account()["headers"]
    mine = client.post("/products", json={"name": "test DEVICES"}, headers=headers).json()

    device = add_device(client, headers, "Bench board")

    assert device["product_id"] == mine["id"]
    assert len(products_named(client, headers, TEST_PRODUCT_NAME)) == 1


def test_each_company_gets_its_own_test_devices_product(client, account):
    a = account(org_name="Factory A")["headers"]
    b = account(org_name="Factory B")["headers"]

    in_a = add_device(client, a, "Bench board")
    in_b = add_device(client, b, "Bench board")

    assert in_a["product_id"] != in_b["product_id"]


def test_a_device_with_a_product_does_not_create_test_devices(client, account):
    headers = account()["headers"]
    product = client.post("/products", json={"name": "Smart Light"}, headers=headers).json()

    device = add_device(client, headers, "Light 1", product_id=product["id"])

    assert device["product_id"] == product["id"]
    assert products_named(client, headers, TEST_PRODUCT_NAME) == []


def test_a_refused_name_leaves_no_test_product_behind(client, account):
    headers = account()["headers"]
    product = client.post("/products", json={"name": "Smart Light"}, headers=headers).json()
    add_device(client, headers, "Light 1", product_id=product["id"])

    refused = client.post("/devices", json={"name": "light 1"}, headers=headers)

    assert refused.status_code == 409
    assert products_named(client, headers, TEST_PRODUCT_NAME) == []


def test_a_product_with_devices_still_cannot_be_deleted(client, account):
    headers = account()["headers"]
    device = add_device(client, headers, "Bench board")

    response = client.delete(f"/products/{device['product_id']}", headers=headers)

    assert response.status_code == 409


def test_the_database_refuses_a_device_without_a_product(db_session, client, account):
    account()
    org_id = db_session.query(Product.org_id).first()
    device = Device(org_id=org_id[0] if org_id else None, name="Orphan", hashed_secret=hash_device_secret(generate_device_secret()))
    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()
