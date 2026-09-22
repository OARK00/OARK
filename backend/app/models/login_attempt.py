import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LoginAttempt(Base):
    """One failed login. Successful logins clear an email's rows.

    Kept in Postgres rather than in memory because a counter that resets when
    the process restarts is not a limit: an attacker only has to wait for a
    deploy. Postgres is also shared, so the count stays correct when more
    than one API instance runs.
    """

    __tablename__ = "login_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Stored lowercased: Rohit@x.com and rohit@x.com are one account to guess.
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    ip: Mapped[str] = mapped_column(String, nullable=False, index=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
