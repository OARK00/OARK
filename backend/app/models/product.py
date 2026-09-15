import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.database import Base


class Product(Base):
    """A type of device, defined once. Devices are the physical units of it."""

    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    description = Column(String, nullable=True)
    model_number = Column(String, nullable=True)

    # What the product's devices send, as a list of
    # {key, label, type, unit, min, max, access}. Replaced as a whole on save;
    # `key` is the exact field name in a device's telemetry "data" object.
    data_points = Column(JSONB, nullable=False, server_default="[]")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
