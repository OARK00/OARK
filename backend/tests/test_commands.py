"""Commands: who may send what, and what happens when the device answers,
stays silent, or comes back."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.command import DeviceCommand
from app.models.device import Device
from app.modules.commands import engine
from app.modules.ingestion.handler import handle_telemetry_message

PUMP_POINTS = [
    {"key": "pump_state", "label": "Pump", "type": "boolean", "access": "write"},
    {"key": "setpoint", "label": "Setpoint", "type": "number", "unit": "bar", "min": 0, "max": 10, "access": "write"},
    {"key": "mode", "label": "Mode", "type": "string", "access": "write"},
    {"key": "pressure", "label": "Pressure", "type": "number", "unit": "bar", "access": "read"},
]


@pytest.fixture()
def pump(client, account):
    """A signed-in account with one pump controller. Returns (headers, device_id, secret)."""
    owner = account("Pump Works")
    headers = owner["headers"]
    product = client.post("/products", json={"name": "Pump controller", "category": "controller"}, headers=headers)
    product_id = product.json()["id"]
    saved = client.put(f"/products/{product_id}/data-points", json={"data_points": PUMP_POINTS}, headers=headers)
    assert saved.status_code == 200, saved.text
    device = client.post("/devices", json={"name": "Pump 1", "product_id": product_id}, headers=headers)
    assert device.status_code == 201, device.text
    return headers, device.json()["id"], device.json()["secret"]


def send(client, pump, key, value):
    headers, device_id, _ = pump
    return client.post(f"/devices/{device_id}/commands", json={"key": key, "value": value}, headers=headers)


def stored(db_session, command_id) -> DeviceCommand:
    return db_session.query(DeviceCommand).filter(DeviceCommand.id == uuid.UUID(command_id)).one()


# --- sending -----------------------------------------------------------------


def test_a_command_is_recorded_and_sent_to_that_device(client, pump, fake_publish):
    _, device_id, _ = pump

    response = send(client, pump, "pump_state", True)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["delivered_at"] is not None
    assert body["sent_by"].endswith("@example.com")
    assert fake_publish["sent"] == [(device_id, {"desired": {"pump_state": True}})]


def test_an_offline_device_keeps_the_command_waiting(client, pump, fake_publish):
    fake_publish["connected"] = False

    body = send(client, pump, "pump_state", True).json()

    assert body["status"] == "pending"
    assert body["delivered_at"] is None


def test_a_broker_outage_still_records_the_command(client, pump, fake_publish, db_session):
    """The history must show what was asked even when sending failed."""
    fake_publish["error"] = "broker down"

    response = send(client, pump, "pump_state", True)

    assert response.status_code == 201
    command = stored(db_session, response.json()["id"])
    assert command.status == "pending"
    assert command.last_sent_at is not None
    assert command.delivered_at is None


def test_read_only_fields_cannot_be_set(client, pump, fake_publish):
    response = send(client, pump, "pressure", 3)

    assert response.status_code == 422
    assert "read-only" in response.json()["detail"]
    assert fake_publish["sent"] == []


def test_unknown_fields_cannot_be_set(client, pump):
    assert send(client, pump, "self_destruct", True).status_code == 422


@pytest.mark.parametrize(
    "key, value",
    [
        ("pump_state", 1),  # which of 0/1 means on is a guess
        ("pump_state", "on"),
        ("pump_state", None),
        ("setpoint", True),  # a bool is not a number, even in Python
        ("setpoint", "5"),
        ("setpoint", 11),  # above max
        ("setpoint", -1),  # below min
        ("mode", ""),
        ("mode", "x" * 65),
        ("mode", {"nested": "object"}),
    ],
)
def test_values_must_fit_the_data_point(client, pump, fake_publish, key, value):
    assert send(client, pump, key, value).status_code == 422
    assert fake_publish["sent"] == []


def test_the_limits_themselves_are_allowed(client, pump):
    assert send(client, pump, "setpoint", 0).status_code == 201
    assert send(client, pump, "setpoint", 10).status_code == 201


def test_a_device_without_a_product_cannot_be_commanded(client, account):
    headers = account()["headers"]
    device_id = client.post("/devices", json={"name": "Loose"}, headers=headers).json()["id"]

    response = client.post(f"/devices/{device_id}/commands", json={"key": "relay", "value": True}, headers=headers)

    assert response.status_code == 422


def test_another_organisations_device_is_not_found(client, pump, account):
    _, device_id, _ = pump
    stranger = account("Someone Else")["headers"]

    response = client.post(
        f"/devices/{device_id}/commands", json={"key": "pump_state", "value": False}, headers=stranger
    )

    assert response.status_code == 404
    assert client.get(f"/devices/{device_id}/commands", headers=stranger).status_code == 404


def test_a_newer_command_replaces_one_still_waiting(client, pump, fake_publish, db_session):
    first = send(client, pump, "pump_state", True).json()
    send(client, pump, "setpoint", 4)
    send(client, pump, "pump_state", False)

    assert stored(db_session, first["id"]).status == "superseded"
    # Every message carries everything still waiting, newest value per field.
    assert fake_publish["sent"][-1][1] == {"desired": {"setpoint": 4, "pump_state": False}}


def test_a_flood_of_commands_is_refused(client, pump, monkeypatch):
    monkeypatch.setattr("app.modules.commands.router.COMMANDS_PER_MINUTE", 3)
    for _ in range(3):
        assert send(client, pump, "pump_state", True).status_code == 201

    assert send(client, pump, "pump_state", True).status_code == 429


def test_the_history_lists_newest_first(client, pump):
    headers, device_id, _ = pump
    send(client, pump, "pump_state", True)
    send(client, pump, "setpoint", 5)

    history = client.get(f"/devices/{device_id}/commands", headers=headers).json()

    assert [entry["key"] for entry in history] == ["setpoint", "pump_state"]


# --- confirmation --------------------------------------------------------------


def test_exact_matches_confirm():
    assert engine.report_confirms(True, True) is True
    assert engine.report_confirms(False, False) is True
    assert engine.report_confirms(5, 5) is True
    assert engine.report_confirms("auto", "auto") is True


def test_opposite_values_do_not_confirm():
    assert engine.report_confirms(True, False) is False
    assert engine.report_confirms(5, 7) is False
    assert engine.report_confirms("auto", "manual") is False
    assert engine.report_confirms(True, None) is False


def test_a_one_is_not_a_yes():
    """Python says True == 1; a switch must not."""
    assert engine.report_confirms(True, 1) is False
    assert engine.report_confirms(False, 0) is False
    assert engine.report_confirms(True, "true") is False


def test_float_noise_confirms_but_a_different_number_does_not():
    assert engine.report_confirms(40, 39.99) is True
    assert engine.report_confirms(40, 40.0) is True
    assert engine.report_confirms(0, 0.004) is True
    assert engine.report_confirms(40, 39) is False
    assert engine.report_confirms(5, "5") is False
    assert engine.report_confirms(5, True) is False


def test_text_must_match_exactly():
    assert engine.report_confirms("auto", "AUTO") is False


def test_the_device_reporting_the_value_marks_it_applied(client, pump, db_session):
    _, device_id, secret = pump
    command_id = send(client, pump, "pump_state", True).json()["id"]

    handle_telemetry_message(db_session, device_id, {"secret": secret, "data": {"pump_state": True, "pressure": 2}})

    command = stored(db_session, command_id)
    assert command.status == "applied"
    assert command.resolved_at is not None


def test_a_report_that_does_not_mention_the_field_changes_nothing(client, pump, db_session):
    _, device_id, secret = pump
    command_id = send(client, pump, "pump_state", True).json()["id"]

    handle_telemetry_message(db_session, device_id, {"secret": secret, "data": {"pressure": 2}})
    handle_telemetry_message(db_session, device_id, {"secret": secret, "data": {"pump_state": False}})

    assert stored(db_session, command_id).status == "pending"


# --- the sweep -------------------------------------------------------------------


def device_row(db_session, device_id) -> Device:
    return db_session.query(Device).filter(Device.id == uuid.UUID(device_id)).one()


def test_unconfirmed_commands_expire(client, pump, db_session):
    command_id = send(client, pump, "pump_state", True).json()["id"]
    later = datetime.now(timezone.utc) + engine.COMMAND_TTL + timedelta(seconds=1)

    engine.sweep(db_session, later)

    # Only this test's command is checked: the sweep covers the whole
    # database, which may hold other waiting commands.
    assert stored(db_session, command_id).status == "expired"


def test_an_expired_command_is_shown_expired_before_the_sweep(client, pump, db_session):
    command = stored(db_session, send(client, pump, "pump_state", True).json()["id"])
    later = datetime.now(timezone.utc) + engine.COMMAND_TTL + timedelta(seconds=1)

    assert engine.display_status(command, later) == "expired"


def test_a_device_that_comes_back_gets_the_command(client, pump, fake_publish, db_session):
    _, device_id, secret = pump
    fake_publish["connected"] = False
    send(client, pump, "pump_state", True)
    fake_publish["connected"] = True
    fake_publish["sent"].clear()

    # The device reconnects and reports (still off, it hasn't been told yet).
    later = datetime.now(timezone.utc) + engine.RESEND_AFTER + timedelta(seconds=1)
    device_row(db_session, device_id).last_seen_at = later
    _, resent = engine.sweep(db_session, later + timedelta(seconds=1))

    assert resent == 1
    assert fake_publish["sent"] == [(device_id, {"desired": {"pump_state": True}})]


def test_nothing_is_resent_to_a_device_that_has_not_been_heard_from(client, pump, fake_publish, db_session):
    fake_publish["connected"] = False
    send(client, pump, "pump_state", True)
    fake_publish["sent"].clear()

    later = datetime.now(timezone.utc) + engine.RESEND_AFTER + timedelta(seconds=1)
    _, resent = engine.sweep(db_session, later)

    assert resent == 0
    assert fake_publish["sent"] == []


def test_resends_are_spaced_out(client, pump, fake_publish, db_session):
    _, device_id, _ = pump
    send(client, pump, "pump_state", True)
    fake_publish["sent"].clear()

    soon = datetime.now(timezone.utc) + timedelta(seconds=2)
    device_row(db_session, device_id).last_seen_at = soon
    _, resent = engine.sweep(db_session, soon)

    assert resent == 0


def test_nothing_expired_is_ever_resent(client, pump, fake_publish, db_session):
    _, device_id, _ = pump
    send(client, pump, "pump_state", True)
    fake_publish["sent"].clear()

    much_later = datetime.now(timezone.utc) + engine.COMMAND_TTL + timedelta(minutes=1)
    device_row(db_session, device_id).last_seen_at = much_later
    engine.sweep(db_session, much_later)

    assert fake_publish["sent"] == []
