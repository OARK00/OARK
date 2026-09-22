"""What /health actually checks.

A health endpoint that always answers "ok" tells you nothing: the service can
be up while the database is unreachable and every request fails. This one
asks the database a real question and reports the MQTT listener's state, so
an uptime monitor pinging it every few minutes is genuinely watching Oark.
"""
import time

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.modules.ingestion.state import ingestion_state

# How long the listener may be disconnected before it counts as a fault
# rather than a normal reconnect or a cold start waking up.
INGESTION_GRACE_SECONDS = 120


def check_database() -> dict:
    started = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        return {"ok": False, "error": type(exc).__name__}
    return {"ok": True, "latency_ms": round((time.perf_counter() - started) * 1000, 1)}


def check_ingestion() -> dict:
    return {
        "connected": ingestion_state.connected,
        "connected_since": ingestion_state.connected_since,
        "last_message_at": ingestion_state.last_message_at,
        "disconnected_for_seconds": ingestion_state.disconnected_for_seconds(),
        "last_error": ingestion_state.last_error,
    }


def overall_status(database_ok: bool, mqtt_connected: bool, mqtt_disconnected_for: float | None) -> tuple[str, int]:
    """Turn the individual checks into one word and one HTTP status code.

    The word is for a human reading the page; the status code is what an
    uptime monitor alerts on. A brief MQTT gap is normal -- every reconnect
    and every cold start on Render's free plan produces one -- so it only
    becomes an alarm once it outlasts INGESTION_GRACE_SECONDS. Alarms that
    cry wolf get ignored, and an ignored alarm protects nothing.
    """
    if not database_ok:
        return "down", 503
    if not mqtt_connected:
        if mqtt_disconnected_for is not None and mqtt_disconnected_for < INGESTION_GRACE_SECONDS:
            return "waiting", 200
        return "degraded", 503
    return "ok", 200


def health_report() -> tuple[dict, int]:
    database = check_database()
    ingestion = check_ingestion()
    status, status_code = overall_status(
        database["ok"], ingestion["connected"], ingestion["disconnected_for_seconds"]
    )
    return (
        {
            "status": status,
            "environment": settings.app_env,
            "checks": {"database": database, "ingestion": ingestion},
        },
        status_code,
    )
