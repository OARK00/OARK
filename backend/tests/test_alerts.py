"""When a rule fires, and — more importantly — when it doesn't."""
from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import generate_device_secret, hash_device_secret
from app.models.alert import AlertEvent, AlertRule
from app.models.device import Device
from app.models.organization import Organization
from app.modules.alerts.engine import check_silent_devices, evaluate_reading, value_breaches


@pytest.fixture()
def org_device(db_session):
    org = Organization(name="Factory A")
    db_session.add(org)
    db_session.flush()
    device = Device(
        org_id=org.id, name="Cold store A", hashed_secret=hash_device_secret(generate_device_secret())
    )
    db_session.add(device)
    db_session.flush()
    return org, device


def make_rule(db_session, org, **kwargs):
    rule = AlertRule(
        org_id=org.id,
        name=kwargs.pop("name", "Too warm"),
        condition=kwargs.pop("condition", "above"),
        data_key=kwargs.pop("data_key", "temperature"),
        threshold=kwargs.pop("threshold", 8.0),
        cooldown_minutes=kwargs.pop("cooldown_minutes", 15),
        **kwargs,
    )
    db_session.add(rule)
    db_session.flush()
    return rule


def test_above_fires_only_past_the_threshold(db_session, org_device):
    org, device = org_device
    rule = make_rule(db_session, org)

    assert value_breaches(rule, 9.0) is True
    assert value_breaches(rule, 8.0) is False  # the threshold is still acceptable
    assert value_breaches(rule, 7.9) is False


def test_a_breach_records_an_event_with_the_value(db_session, org_device):
    org, device = org_device
    make_rule(db_session, org)

    fired = evaluate_reading(db_session, device, {"temperature": 11.5})

    assert len(fired) == 1
    assert fired[0].value == 11.5
    assert "Cold store A" in fired[0].message


def test_a_normal_reading_fires_nothing(db_session, org_device):
    org, device = org_device
    make_rule(db_session, org)

    assert evaluate_reading(db_session, device, {"temperature": 4.0}) == []


def test_the_cooldown_stops_one_fault_becoming_a_hundred_alerts(db_session, org_device):
    org, device = org_device
    make_rule(db_session, org, cooldown_minutes=15)

    first = evaluate_reading(db_session, device, {"temperature": 12.0})
    db_session.flush()
    second = evaluate_reading(db_session, device, {"temperature": 13.0})

    assert len(first) == 1
    assert second == []


def test_the_rule_fires_again_once_the_cooldown_has_passed(db_session, org_device):
    org, device = org_device
    make_rule(db_session, org, cooldown_minutes=15)
    evaluate_reading(db_session, device, {"temperature": 12.0})
    db_session.flush()

    later = datetime.now(timezone.utc) + timedelta(minutes=16)
    again = evaluate_reading(db_session, device, {"temperature": 12.0}, now=later)

    assert len(again) == 1


def test_a_switch_turning_on_is_not_a_threshold_breach(db_session, org_device):
    """True is 1 in Python; a boolean field must not be compared to a limit."""
    org, device = org_device
    make_rule(db_session, org, data_key="running", threshold=0.5)

    assert evaluate_reading(db_session, device, {"running": True}) == []


def test_a_disabled_rule_is_silent(db_session, org_device):
    org, device = org_device
    make_rule(db_session, org, enabled=False)

    assert evaluate_reading(db_session, device, {"temperature": 50.0}) == []


def test_a_rule_scoped_to_another_device_does_not_fire(db_session, org_device):
    org, device = org_device
    other = Device(org_id=org.id, name="Boiler", hashed_secret=hash_device_secret(generate_device_secret()))
    db_session.add(other)
    db_session.flush()
    make_rule(db_session, org, device_id=other.id)

    assert evaluate_reading(db_session, device, {"temperature": 50.0}) == []


def test_silence_is_noticed_after_the_limit(db_session, org_device):
    org, device = org_device
    device.last_seen_at = datetime.now(timezone.utc) - timedelta(minutes=45)
    make_rule(db_session, org, name="Gone quiet", condition="no_data", data_key=None, threshold=None, for_minutes=30)
    db_session.flush()

    fired = [event for event in check_silent_devices(db_session) if event.device_id == device.id]

    assert len(fired) == 1
    assert "no data" in fired[0].message


def test_a_device_that_reported_recently_is_not_silent(db_session, org_device):
    org, device = org_device
    device.last_seen_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    make_rule(db_session, org, name="Gone quiet", condition="no_data", data_key=None, threshold=None, for_minutes=30)
    db_session.flush()

    fired = [event for event in check_silent_devices(db_session) if event.device_id == device.id]

    assert fired == []


def test_rules_and_events_stay_inside_one_organisation(client, account):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    created = client.post(
        "/alerts/rules",
        json={"name": "Too warm", "condition": "above", "data_key": "temperature", "threshold": 8},
        headers=owner["headers"],
    )
    assert created.status_code == 201, created.text

    assert client.get("/alerts/rules", headers=stranger["headers"]).json() == []
    assert (
        client.delete(f"/alerts/rules/{created.json()['id']}", headers=stranger["headers"]).status_code == 404
    )


def test_a_rule_that_could_never_fire_is_refused(client, account):
    headers = account()["headers"]

    missing_threshold = client.post(
        "/alerts/rules", json={"name": "Bad", "condition": "above", "data_key": "temperature"}, headers=headers
    )
    missing_minutes = client.post(
        "/alerts/rules", json={"name": "Bad", "condition": "no_data"}, headers=headers
    )

    assert missing_threshold.status_code == 422
    assert missing_minutes.status_code == 422


def test_a_rule_cannot_watch_another_organisations_device(client, account):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    device = client.post("/devices", json={"name": "Cold store"}, headers=owner["headers"]).json()

    response = client.post(
        "/alerts/rules",
        json={
            "name": "Spy",
            "condition": "above",
            "data_key": "temperature",
            "threshold": 1,
            "device_id": device["id"],
        },
        headers=stranger["headers"],
    )

    assert response.status_code == 404


def test_events_can_be_acknowledged(client, account, db_session):
    created = account()
    device = client.post("/devices", json={"name": "Cold store"}, headers=created["headers"]).json()
    rule = client.post(
        "/alerts/rules",
        json={"name": "Too warm", "condition": "above", "data_key": "temperature", "threshold": 8},
        headers=created["headers"],
    ).json()
    org_id = client.get("/auth/me", headers=created["headers"]).json()["org_id"]
    db_session.add(
        AlertEvent(org_id=org_id, rule_id=rule["id"], device_id=device["id"], message="warm", value=9.0)
    )
    db_session.commit()

    before = client.get("/alerts/events", params={"unacknowledged": True}, headers=created["headers"]).json()
    client.post("/alerts/events/acknowledge", headers=created["headers"])
    after = client.get("/alerts/events", params={"unacknowledged": True}, headers=created["headers"]).json()

    assert len(before) == 1
    assert after == []
    # The event itself is kept: history, not a notification to clear away.
    assert len(client.get("/alerts/events", headers=created["headers"]).json()) == 1
