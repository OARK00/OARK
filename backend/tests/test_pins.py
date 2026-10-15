"""GPIO pins on data points: which ESP32 pins each kind of data point may use.

A wrong pin is not a style problem: an output on an input-only pin does
nothing, an analog reading on an ADC2 pin reads garbage once Wi-Fi is on,
and pins 6-11 crash the board. Refusing them here saves a customer a day.
"""
import pytest

from app.modules.products.schemas import ANALOG_PINS, INPUT_ONLY_PINS, USABLE_PINS, pin_problem

RELAY = {"key": "relay", "label": "Relay", "type": "boolean", "access": "write"}
BUTTON = {"key": "door", "label": "Door", "type": "boolean", "access": "read"}
LEVEL = {"key": "level", "label": "Level", "type": "number", "access": "read"}


def create_product(client, headers):
    response = client.post("/products", json={"name": "Pump"}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def save(client, headers, product, points):
    return client.put(f"/products/{product}/data-points", json={"data_points": points}, headers=headers)


def test_pins_are_saved_and_come_back(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = save(client, headers, product, [
        {**RELAY, "pin": 2, "active_low": True},
        {**BUTTON, "pin": 4},
        {**LEVEL, "pin": 34},
    ])

    assert response.status_code == 200, response.text
    saved = {p["key"]: (p["pin"], p["active_low"]) for p in client.get(f"/products/{product}", headers=headers).json()["data_points"]}
    assert saved == {"relay": (2, True), "door": (4, False), "level": (34, False)}


def test_data_points_without_pins_still_work(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = save(client, headers, product, [RELAY, LEVEL])

    assert response.status_code == 200
    assert all(p["pin"] is None and p["active_low"] is False for p in response.json()["data_points"])


@pytest.mark.parametrize("pin", [6, 7, 8, 9, 10, 11], ids=lambda p: f"flash-gpio-{p}")
def test_flash_pins_are_refused(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**RELAY, "pin": pin}])

    assert response.status_code == 422
    assert f"GPIO {pin}" in response.text


@pytest.mark.parametrize("pin", [1, 3], ids=["tx-gpio-1", "rx-gpio-3"])
def test_the_usb_serial_pins_are_refused(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**BUTTON, "pin": pin}])

    assert response.status_code == 422


@pytest.mark.parametrize("pin", [-1, 40, 99], ids=["negative", "gpio-40", "gpio-99"])
def test_pins_that_do_not_exist_are_refused(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**BUTTON, "pin": pin}])

    assert response.status_code == 422


@pytest.mark.parametrize("pin", sorted(INPUT_ONLY_PINS), ids=lambda p: f"gpio-{p}")
def test_an_output_cannot_use_an_input_only_pin(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**RELAY, "pin": pin}])

    assert response.status_code == 422
    assert "Relay" in response.text


@pytest.mark.parametrize("pin", sorted(INPUT_ONLY_PINS), ids=lambda p: f"gpio-{p}")
def test_a_digital_input_may_use_an_input_only_pin(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**BUTTON, "pin": pin}])

    assert response.status_code == 200, response.text


@pytest.mark.parametrize("pin", [2, 4, 13, 25, 26, 27], ids=lambda p: f"adc2-gpio-{p}")
def test_an_analog_reading_cannot_use_a_pin_wifi_takes_over(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**LEVEL, "pin": pin}])

    assert response.status_code == 422
    assert "Level" in response.text


@pytest.mark.parametrize("pin", sorted(ANALOG_PINS), ids=lambda p: f"adc1-gpio-{p}")
def test_an_analog_reading_may_use_an_adc1_pin(client, account, pin):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**LEVEL, "pin": pin}])

    assert response.status_code == 200, response.text


def test_two_data_points_cannot_share_a_pin(client, account):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**RELAY, "pin": 2}, {**BUTTON, "pin": 2}])

    assert response.status_code == 422
    assert "GPIO 2" in response.text


@pytest.mark.parametrize(
    "point",
    [
        {"key": "mode", "label": "Mode", "type": "string", "access": "write"},
        {"key": "name", "label": "Name", "type": "string", "access": "read"},
        {"key": "speed", "label": "Speed", "type": "number", "access": "write"},
    ],
    ids=["text-control", "text-reading", "number-control"],
)
def test_fields_that_cannot_use_a_pin_are_refused_one(client, account, point):
    headers = account()["headers"]

    response = save(client, headers, create_product(client, headers), [{**point, "pin": 32}])

    assert response.status_code == 422


def test_on_when_low_is_only_kept_for_outputs(client, account):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = save(client, headers, product, [{**BUTTON, "pin": 4, "active_low": True}, {**RELAY, "pin": 2, "active_low": True}])

    by_key = {p["key"]: p for p in response.json()["data_points"]}
    assert by_key["door"]["active_low"] is False
    assert by_key["relay"]["active_low"] is True


def test_the_rule_itself_for_every_usable_pin():
    for pin in USABLE_PINS:
        assert (pin_problem("output", pin) is None) == (pin not in INPUT_ONLY_PINS), f"output on GPIO {pin}"
        assert pin_problem("input", pin) is None, f"input on GPIO {pin}"
        assert (pin_problem("analog", pin) is None) == (pin in ANALOG_PINS), f"analog on GPIO {pin}"
