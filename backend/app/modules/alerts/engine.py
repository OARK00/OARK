"""When a rule fires, and when it stays quiet.

Value rules are checked as each reading arrives, which costs one small query
per message and reports a problem within seconds. Silence rules cannot work
that way -- a device that stopped talking sends nothing to react to -- so
they are checked on a timer instead.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import AlertEvent, AlertRule
from app.models.device import Device

ABOVE = "above"
BELOW = "below"
NO_DATA = "no_data"


def rule_applies_to(rule: AlertRule, device: Device) -> bool:
    """Narrowest scope wins: one device, else a product, else the whole org."""
    if rule.device_id is not None:
        return rule.device_id == device.id
    if rule.product_id is not None:
        return rule.product_id == device.product_id
    return True


def value_breaches(rule: AlertRule, value: float) -> bool:
    """Strict comparison: a rule for "above 8" does not fire at exactly 8.

    The threshold is the last acceptable value, which is how people read
    "keep it below 8" out loud.
    """
    if rule.threshold is None:
        return False
    if rule.condition == ABOVE:
        return value > rule.threshold
    if rule.condition == BELOW:
        return value < rule.threshold
    return False


def in_cooldown(db: Session, rule: AlertRule, device: Device, now: datetime) -> bool:
    """One fault should not send a hundred alerts."""
    last = (
        db.query(func.max(AlertEvent.triggered_at))
        .filter(AlertEvent.rule_id == rule.id, AlertEvent.device_id == device.id)
        .scalar()
    )
    if last is None:
        return False
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return bool(now - last < timedelta(minutes=rule.cooldown_minutes))


def _record(db: Session, rule: AlertRule, device: Device, message: str, value: float | None) -> AlertEvent:
    event = AlertEvent(
        org_id=device.org_id, rule_id=rule.id, device_id=device.id, message=message, value=value
    )
    db.add(event)
    return event


def _enabled_rules(db: Session, org_id, conditions: tuple[str, ...]) -> list[AlertRule]:
    return (
        db.query(AlertRule)
        .filter(
            AlertRule.org_id == org_id,
            AlertRule.enabled.is_(True),
            AlertRule.condition.in_(conditions),
        )
        .all()
    )


def evaluate_reading(db: Session, device: Device, data: dict, now: datetime | None = None) -> list[AlertEvent]:
    """Called for every accepted telemetry message."""
    now = now or datetime.now(timezone.utc)
    fired = []

    for rule in _enabled_rules(db, device.org_id, (ABOVE, BELOW)):
        if not rule_applies_to(rule, device):
            continue
        value = data.get(rule.data_key)
        # Booleans are numbers in Python; a switch turning on is not a
        # temperature crossing a limit.
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        if not value_breaches(rule, float(value)):
            continue
        if in_cooldown(db, rule, device, now):
            continue

        word = "above" if rule.condition == ABOVE else "below"
        fired.append(
            _record(
                db,
                rule,
                device,
                f"{device.name}: {rule.data_key} is {value}, {word} {rule.threshold}",
                float(value),
            )
        )

    return fired


def check_silent_devices(db: Session, now: datetime | None = None) -> list[AlertEvent]:
    """Called on a timer: find devices that should have reported and haven't."""
    now = now or datetime.now(timezone.utc)
    fired = []

    for rule in db.query(AlertRule).filter(AlertRule.enabled.is_(True), AlertRule.condition == NO_DATA).all():
        limit = timedelta(minutes=rule.for_minutes or 30)
        devices = db.query(Device).filter(Device.org_id == rule.org_id).all()

        for device in devices:
            if not rule_applies_to(rule, device):
                continue
            # A device that has never reported is measured from when it was
            # added, so a device that was never connected still shows up.
            reference = device.last_seen_at or device.created_at
            if reference is None:
                continue
            if reference.tzinfo is None:
                reference = reference.replace(tzinfo=timezone.utc)
            if now - reference < limit:
                continue
            if in_cooldown(db, rule, device, now):
                continue

            minutes = int((now - reference).total_seconds() // 60)
            fired.append(
                _record(db, rule, device, f"{device.name}: no data for {minutes} minutes", None)
            )

    return fired
