import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import verify_device_secret
from app.models.device import Device


def handle_telemetry_message(db: Session, device_id_str: str, payload: dict) -> bool:
    """Called for every message on oark/devices/{device_id}/telemetry.

    Returns True if the message was accepted (device exists and its secret
    matched), False if it was rejected.
    """
    try:
        device_id = uuid.UUID(device_id_str)
    except ValueError:
        return False

    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        return False

    secret = payload.get("secret")
    data = payload.get("data")

    if secret is None:
        return False

    if not verify_device_secret(secret, device.hashed_secret):
        return False

    device.last_seen_at = datetime.now(timezone.utc)
    device.reported_state = data

    db.commit()
    return True
