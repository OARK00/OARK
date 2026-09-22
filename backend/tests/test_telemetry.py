"""Reading history back out, which is what the device detail chart draws."""
from datetime import datetime, timedelta, timezone

from app.models.telemetry import TelemetryReading


def create_device(client, headers, name="Cold store A"):
    response = client.post("/devices", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def add_reading(db_session, device_id, org_id, hours_ago, value):
    db_session.add(
        TelemetryReading(
            org_id=org_id,
            device_id=device_id,
            data={"temperature": value},
            recorded_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
        )
    )
    db_session.commit()


def test_hours_limits_the_window(client, account, db_session):
    created = account()
    device = create_device(client, created["headers"])
    org_id = client.get("/auth/me", headers=created["headers"]).json()["org_id"]
    add_reading(db_session, device["id"], org_id, hours_ago=0, value=21.0)
    add_reading(db_session, device["id"], org_id, hours_ago=48, value=9.0)

    last_day = client.get(f"/devices/{device['id']}/telemetry", params={"hours": 24}, headers=created["headers"])
    last_week = client.get(f"/devices/{device['id']}/telemetry", params={"hours": 168}, headers=created["headers"])

    assert [r["data"]["temperature"] for r in last_day.json()] == [21.0]
    # Newest first, which the chart reverses.
    assert [r["data"]["temperature"] for r in last_week.json()] == [21.0, 9.0]


def test_history_belongs_to_one_organisation(client, account, db_session):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    device = create_device(client, owner["headers"])

    response = client.get(f"/devices/{device['id']}/telemetry", headers=stranger["headers"])

    assert response.status_code == 404
