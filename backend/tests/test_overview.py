"""The home page's numbers. They are derived, so the risk is showing a count
from the wrong organisation rather than a stale one."""
import uuid
from datetime import datetime, timedelta, timezone

from app.models.telemetry import TelemetryReading
from app.modules.overview.router import CHART_HOURS


def create_device(client, headers, name="Boiler 2"):
    response = client.post("/devices", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_a_new_account_sees_zeroes_and_an_empty_checklist(client, account):
    headers = account()["headers"]

    data = client.get("/overview", headers=headers).json()

    assert data["devices"] == {"total": 0, "online": 0, "stale": 0, "offline": 0}
    assert data["products"] == 0
    assert data["checklist"] == {"product_created": False, "device_added": False, "first_message": False}
    assert data["recent_devices"] == []


def test_adding_a_device_ticks_one_step_but_not_the_message_step(client, account):
    headers = account()["headers"]
    create_device(client, headers)

    data = client.get("/overview", headers=headers).json()

    assert data["devices"]["total"] == 1
    # A device that has never reported counts as offline, not online.
    assert data["devices"]["offline"] == 1
    assert data["checklist"]["device_added"] is True
    assert data["checklist"]["first_message"] is False


def test_the_chart_covers_every_hour_including_the_quiet_ones(client, account):
    headers = account()["headers"]

    series = client.get("/overview", headers=headers).json()["messages"]["series"]

    assert len(series) == CHART_HOURS + 1
    assert all(point["count"] == 0 for point in series)


def add_readings(db_session, device, hours_ago: list[float]):
    """Readings for one device, each `hours_ago` hours in the past."""
    now = datetime.now(timezone.utc)
    for hours in hours_ago:
        db_session.add(
            TelemetryReading(
                org_id=uuid.UUID(device["org_id"]),
                device_id=uuid.UUID(device["id"]),
                data={"temperature": 20},
                recorded_at=now - timedelta(hours=hours),
            )
        )
    db_session.flush()


def device_for(client, account, org_name, name="Boiler 2"):
    """A device, with the id of the company it belongs to."""
    headers = account(org_name=org_name)["headers"]
    device = create_device(client, headers, name)
    device["org_id"] = client.get("/auth/me", headers=headers).json()["org_id"]
    return headers, device


def test_messages_are_counted_in_the_right_day(client, account, db_session):
    """Three in the last 24 hours, two in the 24 before, one older than both."""
    headers, device = device_for(client, account, "Factory A")
    add_readings(db_session, device, [0.5, 3, 23.5, 24.5, 47, 49])

    messages = client.get("/overview", headers=headers).json()["messages"]

    assert messages["last_24h"] == 3
    assert messages["previous_24h"] == 2
    # The chart is the last 24 hours only: its bars add up to the same three.
    assert sum(point["count"] for point in messages["series"]) == 3


def test_a_message_lands_in_its_own_hour_of_the_chart(client, account, db_session):
    headers, device = device_for(client, account, "Factory A")
    add_readings(db_session, device, [5, 5, 5])
    five_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=5)).replace(minute=0, second=0, microsecond=0)

    series = client.get("/overview", headers=headers).json()["messages"]["series"]

    busy = [point for point in series if point["count"]]
    assert len(busy) == 1
    assert busy[0]["count"] == 3
    assert datetime.fromisoformat(busy[0]["hour"]) == five_hours_ago


def test_another_company_s_messages_are_never_counted(client, account, db_session):
    headers, device = device_for(client, account, "Factory A")
    _, neighbour = device_for(client, account, "Factory B")
    add_readings(db_session, device, [1])
    add_readings(db_session, neighbour, [1, 2, 3, 30, 31])

    messages = client.get("/overview", headers=headers).json()["messages"]

    assert messages["last_24h"] == 1
    assert messages["previous_24h"] == 0


def test_one_organisation_never_counts_another_s_devices(client, account):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    create_device(client, owner["headers"])

    data = client.get("/overview", headers=stranger["headers"]).json()

    assert data["devices"]["total"] == 0
    assert data["checklist"]["device_added"] is False
