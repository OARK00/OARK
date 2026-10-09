"""Crash reports to Sentry, with nothing personal or secret in them.

Off unless SENTRY_DSN is set, so local development and the test suite never
send anything. What a report may carry is decided here, not left to Sentry's
defaults: the error, where it happened and the code path -- never who the
user was, their IP, cookies, headers, request bodies or local variables (the
ingestion code holds device secrets in its locals).
"""
import sentry_sdk
from sentry_sdk.types import Event, Hint

from app.core.config import settings


def scrub(event: Event, hint: Hint | None = None) -> Event:
    """Last check on every report before it leaves Oark."""
    event.pop("user", None)
    request = event.get("request")
    if isinstance(request, dict):
        # Headers carry the login token, cookies the session, the body and
        # query string anything a user typed (passwords, device secrets).
        for key in ("headers", "cookies", "query_string", "data"):
            request.pop(key, None)
    return event


def init_error_tracking(service: str) -> bool:
    """Start Sentry for one service ("api" or "listener"). False = left off."""
    if not settings.sentry_dsn:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        server_name=service,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        # Errors only: no performance tracing, which would use up the quota.
        traces_sample_rate=0,
        before_send=scrub,
    )
    return True
