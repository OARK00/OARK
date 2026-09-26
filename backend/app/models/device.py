import uuid
import enum
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import String, DateTime, ForeignKey, func, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.product import Product

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

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable: devices created before products existed stay standalone.
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product: Mapped[Product | None] = relationship("Product")
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    model_number: Mapped[str | None] = mapped_column(String, nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String, nullable=True)
    is_controllable: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    hashed_secret: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus), nullable=False, default=DeviceStatus.offline
    )

    # Unused: what a device is being asked to change lives in device_commands,
    # derived from the pending rows rather than copied here where it could
    # drift. Kept mapped until a release that no longer reads the column has
    # shipped, so dropping it can never break the version still running.
    desired_state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    reported_state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
