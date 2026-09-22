def test_register_returns_a_working_token(client, account):
    created = account()

    response = client.get("/auth/me", headers=created["headers"])

    assert response.status_code == 200
    assert response.json()["email"] == created["email"]
    assert response.json()["role"] == "owner"


def test_same_email_cannot_register_twice(client, account):
    created = account()

    response = client.post("/auth/register", json={"email": created["email"], "password": "another-password"})

    assert response.status_code == 409


def test_login_with_the_wrong_password_is_refused(client, account):
    created = account()

    response = client.post("/auth/login", json={"email": created["email"], "password": "not-the-password"})

    assert response.status_code == 401


def test_login_does_not_reveal_whether_the_email_exists(client, account):
    created = account()

    wrong_password = client.post("/auth/login", json={"email": created["email"], "password": "nope"})
    unknown_email = client.post("/auth/login", json={"email": "nobody@example.com", "password": "nope"})

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_endpoints_need_a_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/devices").status_code == 401
