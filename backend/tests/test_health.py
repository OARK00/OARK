"""The rule /health uses to decide whether to wake someone up."""
from app.core.health import INGESTION_GRACE_SECONDS, health_report, overall_status
from app.modules.ingestion.state import ingestion_state


def test_everything_working():
    assert overall_status(database_ok=True, mqtt_connected=True, mqtt_disconnected_for=None) == ("ok", 200)


def test_unreachable_database_alarms_immediately():
    assert overall_status(database_ok=False, mqtt_connected=True, mqtt_disconnected_for=None) == ("down", 503)


def test_short_broker_gap_stays_quiet():
    """A cold start or a normal reconnect must not page anyone."""
    assert overall_status(database_ok=True, mqtt_connected=False, mqtt_disconnected_for=5.0) == ("waiting", 200)


def test_long_broker_gap_alarms():
    gap = INGESTION_GRACE_SECONDS + 1
    assert overall_status(database_ok=True, mqtt_connected=False, mqtt_disconnected_for=gap) == ("degraded", 503)


def test_database_failure_outranks_broker_failure():
    assert overall_status(database_ok=False, mqtt_connected=False, mqtt_disconnected_for=1.0) == ("down", 503)


def test_an_api_without_the_listener_does_not_report_on_it(monkeypatch):
    """Once the listener runs as its own service, the API must not guess at
    the state of a process it no longer contains."""
    monkeypatch.setattr(ingestion_state, "connected", False)
    monkeypatch.setattr(ingestion_state, "last_error", "not my job")

    report, status_code = health_report(include_ingestion=False)

    assert status_code == 200
    assert report["status"] == "ok"
    assert "ingestion" not in report["checks"]
    assert report["checks"]["database"]["ok"] is True
