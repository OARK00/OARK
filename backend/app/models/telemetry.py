import uuid

from sqlalchemy import Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    data = Column(JSONB, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
