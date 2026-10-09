"""What may leave Oark in a crash report: the error, never a person or a key."""
import sentry_sdk

from app.core import error_tracking
from app.core.error_tracking import init_error_tracking, scrub


def event_with_everything():
    return {
        "message": "boom",
        "user": {"email": "worker@example.com", "ip_address": "203.0.113.7"},
        "request": {
            "url": "https://api.oark.in/auth/login",
            "method": "POST",
            "headers": {"Authorization": "Bearer eyJ-a-real-looking-token", "User-Agent": "x"},
            "cookies": {"oark_session": "eyJ-session-token"},
            "data": {"email": "worker@example.com", "password": "hunter2-secret"},
            "query_string": "secret=abc123&device=7",
        },
    }


def test_a_report_keeps_the_error_and_where_it_happened():
    event = scrub(event_with_everything())

    assert event["message"] == "boom"
    assert event["request"]["url"] == "https://api.oark.in/auth/login"
    assert event["request"]["method"] == "POST"


def test_a_report_carries_no_person_and_no_secret():
    """Checked on the whole report as text, so a secret can't survive by
    hiding in a field this test didn't think to look at."""
    text = str(scrub(event_with_everything()))

    for leaked in ("worker@example.com", "203.0.113.7", "eyJ", "hunter2", "abc123", "oark_session"):
        assert leaked not in text, f"{leaked!r} would have been sent to Sentry"


def test_a_report_without_a_request_still_passes():
    assert scrub({"message": "listener crashed"}) == {"message": "listener crashed"}


def test_nothing_is_sent_without_a_dsn(monkeypatch):
    monkeypatch.setattr(error_tracking.settings, "sentry_dsn", "")
    started = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: started.append(kwargs))

    assert init_error_tracking("api") is False
    assert started == []


def test_with_a_dsn_the_privacy_options_are_set(monkeypatch):
    monkeypatch.setattr(error_tracking.settings, "sentry_dsn", "https://key@o1.ingest.de.sentry.io/1")
    started = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: started.append(kwargs))

    assert init_error_tracking("api") is True
    options = started[0]
    assert options["send_default_pii"] is False
    assert options["include_local_variables"] is False
    assert options["max_request_body_size"] == "never"
    assert options["traces_sample_rate"] == 0
    assert options["before_send"] is scrub
