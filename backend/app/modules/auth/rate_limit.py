"""Login rate limiting.

Two counters, both needed:

* per email -- stops someone guessing one account's password.
* per IP    -- stops one machine working through many accounts, which the
               per-email counter would never notice.

Both use a short rolling window rather than a lasting lock. A lock would let
anyone disable a customer's account on purpose just by failing logins for
their email, turning a security feature into a way to attack your users.
"""
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.login_attempt import LoginAttempt

EMAIL_MAX_FAILURES = 5
EMAIL_WINDOW = timedelta(minutes=15)

# Higher and wider: a factory office shares one public IP, so several people
# fumbling their passwords must not lock out the building.
IP_MAX_FAILURES = 30
IP_WINDOW = timedelta(minutes=15)

# Rows older than this no longer count towards any limit. A day of history is
# kept so an attack can still be looked at afterwards, and the table is
# trimmed on write, which keeps it bounded without a scheduled job.
RETENTION = timedelta(hours=24)


def client_ip(request: Request) -> str:
    """The caller's address as seen before Render's proxy.

    X-Forwarded-For is a list the proxies append to, so the first entry is
    the original client. It can be forged by the client, which is why it is
    only used for rate limiting, never for authorisation.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _count_since(db: Session, column, value: str, window: timedelta) -> int:
    since = datetime.now(timezone.utc) - window
    return (
        db.execute(
            select(func.count(LoginAttempt.id)).where(column == value, LoginAttempt.attempted_at >= since)
        ).scalar()
        or 0
    )


def count_email_failures(db: Session, email: str) -> int:
    return _count_since(db, LoginAttempt.email, email.lower(), EMAIL_WINDOW)


def count_ip_failures(db: Session, ip: str) -> int:
    return _count_since(db, LoginAttempt.ip, ip, IP_WINDOW)


def record_failure(db: Session, email: str, ip: str) -> None:
    db.add(LoginAttempt(email=email.lower(), ip=ip))
    db.execute(delete(LoginAttempt).where(LoginAttempt.attempted_at < datetime.now(timezone.utc) - RETENTION))
    db.commit()


def clear_failures(db: Session, email: str) -> None:
    """A correct password proves the earlier attempts were the owner fumbling."""
    db.execute(delete(LoginAttempt).where(LoginAttempt.email == email.lower()))
    db.commit()


def retry_after_seconds(db: Session, email: str, ip: str) -> int:
    """How long until the oldest failure in the window expires."""
    oldest = db.execute(
        select(func.min(LoginAttempt.attempted_at)).where(
            (LoginAttempt.email == email.lower()) | (LoginAttempt.ip == ip),
            LoginAttempt.attempted_at >= datetime.now(timezone.utc) - max(EMAIL_WINDOW, IP_WINDOW),
        )
    ).scalar()
    if oldest is None:
        return 0
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=timezone.utc)
    remaining = (oldest + max(EMAIL_WINDOW, IP_WINDOW)) - datetime.now(timezone.utc)
    return max(1, int(remaining.total_seconds()))


def is_rate_limited(email_failures: int, ip_failures: int) -> bool:
    """Whether this login attempt should be refused before checking the password.

    email_failures: recent failures for this email address
    ip_failures:    recent failures from this network address
    """
    return email_failures >= EMAIL_MAX_FAILURES or ip_failures >= IP_MAX_FAILURES