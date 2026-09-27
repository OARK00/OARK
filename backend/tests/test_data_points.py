"""What a product may declare about its fields, in particular buttons."""
import pytest
from pydantic import ValidationError

from app.modules.products.schemas import DataPoint

DRIVE = {
    "key": "drive",
    "label": "Drive",
    "type": "string",
    "access": "write",
    "widget": "buttons",
    "options": ["forward", "reverse", "stop"],
    "release_value": "stop",
}


def test_a_button_field_keeps_its_values_and_release():
    point = DataPoint.model_validate(DRIVE)

    assert point.widget == "buttons"
    assert point.options == ["forward", "reverse", "stop"]
    assert point.release_value == "stop"


def test_values_are_trimmed():
    point = DataPoint.model_validate({**DRIVE, "options": [" forward ", "stop "], "release_value": "stop"})

    assert point.options == ["forward", "stop"]


@pytest.mark.parametrize(
    "change",
    [
        {"options": []},  # buttons with nothing to press
        {"options": None},
        {"access": "read"},  # a button on a field Oark can't control
        {"type": "boolean"},  # buttons send text values
        {"release_value": "brake"},  # not one of the buttons
        {"options": ["forward", "forward"], "release_value": None},
        {"options": ["", "stop"]},
        {"options": ["x" * 33, "stop"]},
        {"options": [f"v{i}" for i in range(9)], "release_value": None},
    ],
)
def test_broken_button_definitions_are_refused(change):
    with pytest.raises(ValidationError):
        DataPoint.model_validate({**DRIVE, **change})


def test_a_release_value_without_buttons_is_dropped():
    point = DataPoint.model_validate({**DRIVE, "widget": None})

    assert point.release_value is None
    assert point.options == ["forward", "reverse", "stop"]  # still a whitelist


def test_options_are_dropped_from_non_text_fields():
    point = DataPoint.model_validate(
        {"key": "t", "label": "T", "type": "number", "options": ["1", "2"], "release_value": "1"}
    )

    assert point.options is None
    assert point.release_value is None


def test_older_definitions_without_widgets_still_load():
    point = DataPoint.model_validate({"key": "temperature", "label": "Temperature", "type": "number"})

    assert point.widget is None
    assert point.options is None


def test_a_product_saves_and_returns_its_buttons(client, account):
    headers = account()["headers"]
    product_id = client.post("/products", json={"name": "Car"}, headers=headers).json()["id"]

    saved = client.put(f"/products/{product_id}/data-points", json={"data_points": [DRIVE]}, headers=headers)

    assert saved.status_code == 200, saved.text
    point = saved.json()["data_points"][0]
    assert point["widget"] == "buttons"
    assert point["options"] == ["forward", "reverse", "stop"]
    assert point["release_value"] == "stop"
