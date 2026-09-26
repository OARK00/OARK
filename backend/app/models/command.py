import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# pending: waiting for the device to report the new value.
# applied: the device reported it.
# superseded: a newer command for the same field replaced it before it applied.
# expired: the device never confirmed in time, so it will not be sent again.
COMMAND_STATUSES = ("pending", "applied", "superseded", "expired")


class DeviceCommand(Base):
    """One instruction to a device: set this field to this value.

    Kept after it resolves, because "who switched the pump off at 3 am" is a
    question an industrial customer will ask, and the answer must not depend
    on the device remembering.
    """

    __tablename__ = "device_commands"
    __table_args__ = (Index("ix_device_commands_device_status", "device_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    # The data point's key, exactly as the device reports it in telemetry.
    key: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="pending")

    # SET NULL: removing a user must not rewrite what the device was told.
    sent_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # Last attempt to send it, whatever the result; spaces out resends.
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Last time the broker handed it to the connected device. Null means it
    # has not reached the device yet, so it is sent when the device is back.
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
