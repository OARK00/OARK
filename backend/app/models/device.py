import uuid
import enum
from datetime import datetime, timedelta, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, func, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base

ONLINE_WINDOW = timedelta(minutes=2)
STALE_WINDOW = timedelta(minutes=15)


class DeviceStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    stale = "stale"


def compute_status(last_seen_at: datetime | None) -> DeviceStatus:
    """A device's status is derived from when it was last heard from, not
    stored as a fact someone has to remember to update. No report yet, or
    nothing in a long while, reads as offline; a recent gap reads as stale
    -- a warning before it drops fully offline."""
    if last_seen_at is None:
        return DeviceStatus.offline

    if last_seen_at.tzinfo is None:
        last_seen_at = last_seen_at.replace(tzinfo=timezone.utc)

    age = datetime.now(timezone.utc) - last_seen_at
    if age <= ONLINE_WINDOW:
        return DeviceStatus.online
    if age <= STALE_WINDOW:
        return DeviceStatus.stale
    return DeviceStatus.offline


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    is_controllable = Column(Boolean, nullable=False, server_default="false")
    hashed_secret = Column(String, nullable=False)
    status = Column(Enum(DeviceStatus), nullable=False, default=DeviceStatus.offline)

    # Device Shadow: commands write desired_state; the device's own reports
    # update reported_state on reconnect, so a command to an offline device
    # is queued instead of lost (Oark_Master_Document.docx, Sec. 3).
    desired_state = Column(JSONB, nullable=False, server_default="{}")
    reported_state = Column(JSONB, nullable=False, server_default="{}")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
