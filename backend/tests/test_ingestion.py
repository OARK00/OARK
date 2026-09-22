"""The gate every telemetry message passes through.

These call the handler directly instead of going through MQTT: the broker's
job is delivery, the handler's job is deciding what is real.
"""
import uuid

import pytest

from app.core.security import generate_device_secret, hash_device_secret
from app.models.device import Device
from app.models.organization import Organization
from app.models.telemetry import TelemetryReading
from app.modules.ingestion.handler import handle_telemetry_message


@pytest.fixture()
def device_with_secret(db_session):
    org = Organization(name="Factory A")
    db_session.add(org)
    db_session.flush()

    secret = generate_device_secret()
    device = Device(org_id=org.id, name="Boiler sensor", hashed_secret=hash_device_secret(secret))
    db_session.add(device)
    db_session.flush()
    return device, secret


def readings_for(db_session, device) -> int:
    return db_session.query(TelemetryReading).filter(TelemetryReading.device_id == device.id).count()


def test_a_correct_secret_is_stored_and_recorded(db_session, device_with_secret):
    device, secret = device_with_secret

    accepted = handle_telemetry_message(db_session, str(device.id), {"secret": secret, "data": {"temp": 42}})

    assert accepted is True
    assert device.reported_state == {"temp": 42}
    assert device.last_seen_at is not None
    assert readings_for(db_session, device) == 1


def test_a_wrong_secret_changes_nothing(db_session, device_with_secret):
    device, _ = device_with_secret

    accepted = handle_telemetry_message(db_session, str(device.id), {"secret": "guessed", "data": {"temp": 99}})

    assert accepted is False
    assert device.reported_state == {}
    assert device.last_seen_at is None
    assert readings_for(db_session, device) == 0


def test_a_device_cannot_speak_for_another_device(db_session, device_with_secret):
    """The secret must belong to the device in the topic, not just to some device."""
    victim, _ = device_with_secret
    impostor_secret = generate_device_secret()
    impostor = Device(
        org_id=victim.org_id, name="Impostor", hashed_secret=hash_device_secret(impostor_secret)
    )
    db_session.add(impostor)
    db_session.flush()

    accepted = handle_telemetry_message(
        db_session, str(victim.id), {"secret": impostor_secret, "data": {"temp": 1}}
    )

    assert accepted is False
    assert readings_for(db_session, victim) == 0


def test_messages_without_a_secret_are_rejected(db_session, device_with_secret):
    device, _ = device_with_secret

    assert handle_telemetry_message(db_session, str(device.id), {"data": {"temp": 1}}) is False


@pytest.mark.parametrize(
    "payload",
    [
        {"secret": "s"},  # no data at all
        {"secret": "s", "data": None},
        {"secret": "s", "data": [1, 2, 3]},
        {"secret": "s", "data": "warm"},
        {"secret": 42, "data": {"temp": 1}},
        ["not", "an", "object"],
        "plain text",
    ],
)
def test_malformed_messages_are_rejected_without_raising(db_session, device_with_secret, payload):
    """A badly flashed device must not be able to drop ingestion for everyone."""
    device, _ = device_with_secret

    assert handle_telemetry_message(db_session, str(device.id), payload) is False
    assert device.last_seen_at is None
    assert readings_for(db_session, device) == 0


def test_unknown_and_malformed_device_ids_are_rejected(db_session):
    assert handle_telemetry_message(db_session, str(uuid.uuid4()), {"secret": "x", "data": {}}) is False
    assert handle_telemetry_message(db_session, "not-a-uuid", {"secret": "x", "data": {}}) is False
