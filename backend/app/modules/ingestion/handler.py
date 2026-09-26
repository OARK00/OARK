import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import verify_device_secret
from app.models.device import Device
from app.models.telemetry import TelemetryReading
from app.modules.alerts.engine import evaluate_reading
from app.modules.commands.engine import resolve_commands


def handle_telemetry_message(db: Session, device_id_str: str, payload: object) -> bool:
    """Called for every message on oark/devices/{device_id}/telemetry.

    Returns True if the message was accepted (device exists and its secret
    matched), False if it was rejected. Anything a device can put on the wire
    arrives here, so every field is checked before it is trusted: a rejected
    message must cost one log line, never an exception that would drop the
    listener's connection for everyone.
    """
    if not isinstance(payload, dict):
        return False

    try:
        device_id = uuid.UUID(device_id_str)
    except ValueError:
        return False

    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        return False

    secret = payload.get("secret")
    data = payload.get("data")

    if not isinstance(secret, str):
        return False

    # reported_state is NOT NULL and every reader treats it as an object, so
    # a message without a proper "data" object is malformed, not an update.
    if not isinstance(data, dict):
        return False

    if not verify_device_secret(secret, device.hashed_secret):
        return False

    now = datetime.now(timezone.utc)
    device.last_seen_at = now
    device.reported_state = data
    db.add(TelemetryReading(org_id=device.org_id, device_id=device.id, data=data))

    # Checked here rather than on a timer so a breach is recorded within
    # seconds of arriving, and in the same transaction as the reading that
    # caused it: an alert can never refer to data that was rolled back.
    evaluate_reading(db, device, data)
    resolve_commands(db, device, data, now)

    db.commit()
    return True
