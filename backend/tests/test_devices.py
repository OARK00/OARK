def create_device(client, headers, name="Boiler sensor"):
    response = client.post("/devices", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_creating_a_device_returns_a_secret_and_a_broker_login(client, account, fake_broker):
    headers = account()["headers"]

    device = create_device(client, headers)

    assert device["secret"]
    assert ("create", device["id"]) in fake_broker


def test_a_device_is_only_visible_to_its_own_organisation(client, account):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    device = create_device(client, owner["headers"])

    listed = client.get("/devices", headers=stranger["headers"]).json()
    fetched = client.get(f"/devices/{device['id']}", headers=stranger["headers"])

    assert device["id"] not in [d["id"] for d in listed]
    assert fetched.status_code == 404


def test_the_secret_is_never_returned_again(client, account):
    headers = account()["headers"]
    device = create_device(client, headers)

    fetched = client.get(f"/devices/{device['id']}", headers=headers).json()

    assert "secret" not in fetched


def test_resetting_credentials_issues_a_new_secret(client, account, fake_broker):
    headers = account()["headers"]
    device = create_device(client, headers)

    reset = client.post(f"/devices/{device['id']}/credentials", headers=headers)

    assert reset.status_code == 200
    assert reset.json()["secret"] != device["secret"]
    assert ("replace", device["id"]) in fake_broker


def test_a_stranger_cannot_reset_someone_elses_device(client, account, fake_broker):
    owner = account(org_name="Factory A")
    stranger = account(org_name="Factory B")
    device = create_device(client, owner["headers"])

    response = client.post(f"/devices/{device['id']}/credentials", headers=stranger["headers"])

    assert response.status_code == 404
    assert ("replace", device["id"]) not in fake_broker


def test_deleting_a_device_removes_its_broker_login(client, account, fake_broker):
    headers = account()["headers"]
    device = create_device(client, headers)

    response = client.delete(f"/devices/{device['id']}", headers=headers)

    assert response.status_code == 204
    assert ("delete", device["id"]) in fake_broker
    assert client.get(f"/devices/{device['id']}", headers=headers).status_code == 404
