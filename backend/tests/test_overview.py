"""The home page's numbers. They are derived, so the risk is showing a count
from the wrong organisation rather than a stale one."""
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


def test_one_organisation_never_counts_another_s_devices(client, account):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    create_device(client, owner["headers"])

    data = client.get("/overview", headers=stranger["headers"]).json()

    assert data["devices"]["total"] == 0
    assert data["checklist"]["device_added"] is False
