"""Attacks on the login token: every forged, expired or altered token must be
refused with 401.

The tokens here are built by hand (base64 + HMAC), not with the JWT library
the app uses. A test that forged its tokens with the same library it is
testing could share that library's bugs and still pass.
"""
import base64
import hashlib
import hmac
import json
import time
import uuid

import pytest

from app.core.config import settings
from app.core.security import SESSION_COOKIE_NAME


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_token(payload: dict, secret: str | None = None, alg: str = "HS256") -> str:
    header = b64(json.dumps({"alg": alg, "typ": "JWT"}).encode())
    body = b64(json.dumps(payload).encode())
    signing_input = f"{header}.{body}"
    if alg == "none":
        return signing_input + "."
    digest = {"HS256": hashlib.sha256, "HS512": hashlib.sha512}[alg]
    key = (secret if secret is not None else settings.jwt_secret).encode()
    signature = hmac.new(key, signing_input.encode(), digest).digest()
    return f"{signing_input}.{b64(signature)}"


@pytest.fixture()
def user(client, account):
    """A real user: their id and the claims a genuine token would carry."""
    created = account()
    me = client.get("/auth/me", headers=created["headers"]).json()
    claims = {"sub": me["id"], "org_id": me["org_id"], "role": me["role"], "exp": int(time.time()) + 3600}
    return claims


def me_with(client, token: str):
    return client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_a_correct_hand_made_token_is_accepted(client, user):
    """The control: without it, a broken make_token would make every
    "refused" test below pass for the wrong reason."""
    assert me_with(client, make_token(user)).status_code == 200


def test_an_expired_token_is_refused(client, user):
    expired = {**user, "exp": int(time.time()) - 60}
    assert me_with(client, make_token(expired)).status_code == 401


def test_a_token_signed_with_another_secret_is_refused(client, user):
    assert me_with(client, make_token(user, secret="a-secret-an-attacker-guessed")).status_code == 401


def test_an_unsigned_token_is_refused(client, user):
    """alg "none": the classic trick of sending a token with no signature."""
    assert me_with(client, make_token(user, alg="none")).status_code == 401


def test_a_token_using_another_algorithm_is_refused(client, user):
    """Only the configured algorithm is accepted, even with the right secret."""
    assert me_with(client, make_token(user, alg="HS512")).status_code == 401


def test_a_token_changed_to_another_user_is_refused(client, account, user):
    """Swap in someone else's id but keep the original signature."""
    victim = client.get("/auth/me", headers=account()["headers"]).json()
    header, _, signature = make_token(user).split(".")
    forged_body = b64(json.dumps({**user, "sub": victim["id"]}).encode())

    assert me_with(client, f"{header}.{forged_body}.{signature}").status_code == 401


def test_a_token_without_a_user_is_refused(client, user):
    no_sub = {key: value for key, value in user.items() if key != "sub"}
    assert me_with(client, make_token(no_sub)).status_code == 401


def test_a_token_for_a_user_that_does_not_exist_is_refused(client, user):
    assert me_with(client, make_token({**user, "sub": str(uuid.uuid4())})).status_code == 401


def test_a_token_whose_user_id_is_not_an_id_is_refused(client, user):
    """Must be a clean 401, not a database error."""
    assert me_with(client, make_token({**user, "sub": "not-a-real-id"})).status_code == 401


def test_a_token_without_an_expiry_is_refused(client, user):
    """A signed token with no exp would work forever."""
    no_exp = {key: value for key, value in user.items() if key != "exp"}
    assert me_with(client, make_token(no_exp)).status_code == 401


def test_garbage_is_refused(client):
    assert me_with(client, "not.a.token").status_code == 401


def test_a_forged_cookie_is_refused_too(client, user):
    """The browser path: the cookie goes through the same checks as the header."""
    forged = make_token(user, secret="a-secret-an-attacker-guessed")
    response = client.get("/auth/me", cookies={SESSION_COOKIE_NAME: forged})
    assert response.status_code == 401
