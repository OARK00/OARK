"""One name per company, for products and for devices.

"Helmet", "helmet" and "  Helmet " would look identical in every list, so
they are one name. Another company's names are none of ours.
"""
import pytest

from app.core.names import clean_name, name_key


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


def test_names_are_stored_clean(client, account):
    headers = account()["headers"]
    assert create_product(client, headers, "  Smart   Helmet ").json()["name"] == "Smart Helmet"
    assert create_device(client, headers, "  Helmet   7 ").json()["name"] == "Helmet 7"
