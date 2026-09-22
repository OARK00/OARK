"""The rule /health uses to decide whether to wake someone up."""
from app.core.health import INGESTION_GRACE_SECONDS, overall_status


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
