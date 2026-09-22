"""Login rate limiting.

The unit tests below describe the policy; the endpoint tests check it is
actually applied before the password is ever compared.
"""
from app.modules.auth.rate_limit import (
    EMAIL_MAX_FAILURES,
    IP_MAX_FAILURES,
    clear_failures,
    count_email_failures,
    is_rate_limited,
    record_failure,
)


def test_a_few_mistakes_are_allowed():
    assert is_rate_limited(email_failures=EMAIL_MAX_FAILURES - 1, ip_failures=0) is False


def test_too_many_failures_for_one_email_are_blocked():
    assert is_rate_limited(email_failures=EMAIL_MAX_FAILURES, ip_failures=0) is True


def test_one_machine_working_through_many_accounts_is_blocked():
    """Each email is still under its own limit, but the IP is not."""
    assert is_rate_limited(email_failures=1, ip_failures=IP_MAX_FAILURES) is True


def test_failures_are_counted_per_email(db_session):
    record_failure(db_session, "Someone@Example.com", "1.2.3.4")
    record_failure(db_session, "someone@example.com", "5.6.7.8")

    # Same account whichever way it was typed.
    assert count_email_failures(db_session, "someone@example.com") == 2
    assert count_email_failures(db_session, "other@example.com") == 0


def test_a_successful_login_clears_the_count(db_session):
    record_failure(db_session, "someone@example.com", "1.2.3.4")
    clear_failures(db_session, "someone@example.com")

    assert count_email_failures(db_session, "someone@example.com") == 0


def test_the_endpoint_blocks_after_repeated_wrong_passwords(client, account, db_session):
    created = account()

    for _ in range(EMAIL_MAX_FAILURES):
        assert client.post("/auth/login", json={"email": created["email"], "password": "wrong"}).status_code == 401

    blocked = client.post("/auth/login", json={"email": created["email"], "password": "wrong"})

    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_the_block_applies_even_to_the_right_password(client, account):
    """Otherwise an attacker who guesses correctly simply walks in."""
    created = account()

    for _ in range(EMAIL_MAX_FAILURES):
        client.post("/auth/login", json={"email": created["email"], "password": "wrong"})

    blocked = client.post(
        "/auth/login", json={"email": created["email"], "password": "correct-horse-battery"}
    )

    assert blocked.status_code == 429


def test_an_untouched_account_still_logs_in(client, account):
    created = account()

    response = client.post(
        "/auth/login", json={"email": created["email"], "password": "correct-horse-battery"}
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
