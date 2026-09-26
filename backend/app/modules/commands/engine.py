"""The life of a command: checked, recorded, sent, confirmed or expired.

A device confirms a command the ordinary way, by reporting the new value in
its telemetry. There is no separate acknowledgement message: "the pump says
it is on" is the only confirmation that means anything, and it needs no
extra protocol in the firmware.
"""
import logging
import math
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core import broker
from app.models.command import DeviceCommand
from app.models.device import Device
from app.modules.products.schemas import DataPoint

logger = logging.getLogger("oark.commands")

# How long a command may wait for its device. After this it is dropped
# rather than delivered late: a pump must not start by itself hours after
# someone asked, when nobody is watching any more.
COMMAND_TTL = timedelta(minutes=5)

# A command the device has not confirmed is sent again, but only once the
# device has been heard from since the last try, and no more often than this.
RESEND_AFTER = timedelta(seconds=15)

MAX_TEXT_COMMAND_LENGTH = 64


class CommandRejected(Exception):
    """The command cannot be sent as asked; the message says why, for people."""


def writable_point(device: Device, key: str) -> DataPoint:
    """Only fields the product marks as controllable can be set, so a typo or
    a crafted request can never write to something that was meant to be read."""
    if device.product is None:
        raise CommandRejected("This device has no product, so Oark doesn't know what it can control.")
    for raw in device.product.data_points:
        point = DataPoint.model_validate(raw)
        if point.key == key:
            if point.access != "write":
                raise CommandRejected(f"{point.label} is read-only on {device.product.name}.")
            return point
    raise CommandRejected(f'{device.product.name} has no data point "{key}".')


def validate_value(point: DataPoint, value: Any) -> Any:
    if point.type == "boolean":
        # 0 and 1 are refused on purpose: which one means "on" is a guess.
        if not isinstance(value, bool):
            raise CommandRejected(f"{point.label} takes on or off (true or false).")
        return value

    if point.type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise CommandRejected(f"{point.label} takes a number.")
        unit = f" {point.unit}" if point.unit else ""
        if point.min is not None and value < point.min:
            raise CommandRejected(f"{point.label} can't be set below {point.min:g}{unit}.")
        if point.max is not None and value > point.max:
            raise CommandRejected(f"{point.label} can't be set above {point.max:g}{unit}.")
        return value

    if not isinstance(value, str) or not value.strip():
        raise CommandRejected(f"{point.label} takes some text.")
    if len(value) > MAX_TEXT_COMMAND_LENGTH:
        raise CommandRejected(f"{point.label} takes at most {MAX_TEXT_COMMAND_LENGTH} characters.")
    return value


def report_confirms(sent: Any, reported: Any) -> bool:
    """Does a value the device reported confirm the value it was sent?

    `sent` has already passed validate_value, so it is a bool, a finite
    number, or a non-empty string. `reported` is whatever the firmware put in
    its telemetry for the same key -- anything JSON can hold.
    """
    if isinstance(sent, bool):
        # The same rule as sending: only true means on. A device reporting 1
        # has not said the pump is on, and Python's True == 1 must not say it for it.
        return isinstance(reported, bool) and reported == sent

    if isinstance(sent, (int, float)):
        if isinstance(reported, bool) or not isinstance(reported, (int, float)):
            return False
        # A float on the device can come back as 39.99 for 40: that counts.
        # 39 for 40 does not -- the tolerance is 0.1%, or 0.01 near zero.
        return math.isclose(sent, reported, rel_tol=1e-3, abs_tol=1e-2)

    return isinstance(reported, str) and reported == sent


def display_status(command: DeviceCommand, now: datetime) -> str:
    """Expiry is decided by the clock, so it is shown from the clock too,
    even in the seconds before the sweep writes it down."""
    if command.status == "pending" and command.created_at <= now - COMMAND_TTL:
        return "expired"
    return command.status


def waiting_commands(db: Session, device_id, now: datetime) -> list[DeviceCommand]:
    return (
        db.query(DeviceCommand)
        .filter(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status == "pending",
            DeviceCommand.created_at > now - COMMAND_TTL,
        )
        .order_by(DeviceCommand.created_at)
        .all()
    )


def resolve_commands(db: Session, device: Device, data: dict, now: datetime) -> list[DeviceCommand]:
    """Called with every accepted report, in the same transaction as the
    reading, so every report is seen: a pump confirmed "on" and then switched
    off by hand a second later still counts as confirmed, and is not
    switched back on by a resend."""
    applied = []
    for command in waiting_commands(db, device.id, now):
        if command.key in data and report_confirms(command.value, data[command.key]):
            command.status = "applied"
            command.resolved_at = now
            applied.append(command)
    return applied


def send_waiting(db: Session, device_id, now: datetime) -> bool:
    """Send everything still waiting for this device, as one message.

    The whole set goes every time, not just the newest command: applying it
    is idempotent, so a repeated message is harmless, and a device that
    missed one message catches up from the next. Returns whether the broker
    handed it to the device. The caller commits.
    """
    waiting = waiting_commands(db, device_id, now)
    if not waiting:
        return False

    desired = {command.key: command.value for command in waiting}
    for command in waiting:
        command.last_sent_at = now
    delivered = broker.publish_to_device(str(device_id), {"desired": desired})
    if delivered:
        for command in waiting:
            command.delivered_at = now
    return delivered


def expire_old_commands(db: Session, now: datetime) -> int:
    return (
        db.query(DeviceCommand)
        .filter(DeviceCommand.status == "pending", DeviceCommand.created_at <= now - COMMAND_TTL)
        .update({DeviceCommand.status: "expired", DeviceCommand.resolved_at: now})
    )


def devices_due_a_resend(db: Session, now: datetime) -> list:
    """Devices with an unconfirmed command that have reported since the last
    try -- they are connected again, or still connected and the message was
    lost -- and whose last try was long enough ago."""
    rows = (
        db.query(DeviceCommand.device_id)
        .join(Device, Device.id == DeviceCommand.device_id)
        .filter(
            DeviceCommand.status == "pending",
            DeviceCommand.created_at > now - COMMAND_TTL,
            or_(DeviceCommand.last_sent_at.is_(None), DeviceCommand.last_sent_at <= now - RESEND_AFTER),
            Device.last_seen_at > func.coalesce(DeviceCommand.last_sent_at, DeviceCommand.created_at),
        )
        .distinct()
        .all()
    )
    return [row.device_id for row in rows]


def sweep(db: Session, now: datetime) -> tuple[int, int]:
    """Expire what waited too long, then resend what is due. Returns
    (expired, resent devices). The caller commits."""
    expired = expire_old_commands(db, now)
    resent = 0
    for device_id in devices_due_a_resend(db, now):
        try:
            send_waiting(db, device_id, now)
            resent += 1
        except broker.BrokerError as error:
            # The attempt time is kept, so the next try waits RESEND_AFTER.
            logger.warning("Resend to device %s failed: %s", device_id, error)
    return expired, resent
