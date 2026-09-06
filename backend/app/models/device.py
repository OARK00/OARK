import uuid
import enum

from sqlalchemy import Column, String, DateTime, ForeignKey, func, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class DeviceStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    stale = "stale"


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
