"""The session cookie the browser actually relies on.

A test's own client library respects the Secure flag the same way a real
browser does: it won't resend a Secure cookie over the plain-http transport
these tests run on, only over https. Real traffic is always https, so that
restriction is exactly right in production -- here it just means the
cookie-only checks below hand the cookie back explicitly per request
instead of leaning on the client's cookie jar, which proves the same thing
get_current_user actually does with a real browser's cookie header.
"""
from app.core.security import SESSION_COOKIE_NAME


def login_response(client, account):
    created = account()
    response = client.post("/auth/login", json={"email": created["email"], "password": "correct-horse-battery"})
    return created, response


def test_login_sets_an_httponly_secure_cookie(client, account):
    _, response = login_response(client, account)

    cookie_header = response.headers.get("set-cookie", "")
    assert f"{SESSION_COOKIE_NAME}=" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "Secure" in cookie_header
    assert "SameSite=lax" in cookie_header
    assert response.json()["access_token"] in cookie_header


def test_register_also_sets_the_cookie(client):
    response = client.post(
        "/auth/register", json={"email": "cookie-test@example.com", "password": "correct-horse-battery"}
    )

    assert SESSION_COOKIE_NAME in response.headers.get("set-cookie", "")


def test_the_cookie_alone_authenticates_with_no_header_at_all(client, account):
    created, response = login_response(client, account)
    token = response.json()["access_token"]

    me = client.get("/auth/me", cookies={SESSION_COOKIE_NAME: token})

    assert me.status_code == 200
    assert me.json()["email"] == created["email"]


def test_a_missing_or_wrong_cookie_is_refused(client):
    assert client.get("/auth/me", cookies={SESSION_COOKIE_NAME: "not-a-real-token"}).status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_a_header_still_works_when_no_cookie_is_sent(client, account):
    """Scripts and any future non-browser client never touch this cookie."""
    created = account()

    response = client.get("/auth/me", headers=created["headers"])

    assert response.status_code == 200
    assert response.json()["email"] == created["email"]


def test_a_valid_header_wins_over_a_bad_cookie(client, account):
    created = account()

    response = client.get(
        "/auth/me", headers=created["headers"], cookies={SESSION_COOKIE_NAME: "garbage"}
    )

    assert response.status_code == 200


def test_logout_clears_the_cookie(client):
    response = client.post("/auth/logout")

    assert response.status_code == 204
    cookie_header = response.headers.get("set-cookie", "")
    assert f"{SESSION_COOKIE_NAME}=" in cookie_header
    # An expired Max-Age tells the browser to delete it immediately.
    assert "Max-Age=0" in cookie_header
