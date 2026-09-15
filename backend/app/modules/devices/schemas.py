import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

# Pydantic reserves the "model_" prefix for its own methods; model_number is a
# plain data field, so opt out of that check.
NO_PROTECTED_NAMESPACES = ConfigDict(protected_namespaces=())


class DeviceCreate(BaseModel):
    model_config = NO_PROTECTED_NAMESPACES

    name: str
    # When set, the device takes its category from the product.
    product_id: uuid.UUID | None = None
    category: str | None = None
    description: str | None = None
    model_number: str | None = None
    firmware_version: str | None = None
    is_controllable: bool = False


class DeviceCreateResponse(BaseModel):
    model_config = NO_PROTECTED_NAMESPACES

    id: uuid.UUID
    name: str
    product_id: uuid.UUID | None
    category: str | None
    description: str | None
    model_number: str | None
    firmware_version: str | None
    secret: str  # shown once at creation time, never again


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    name: str
    product_id: uuid.UUID | None
    product_name: str | None
    category: str | None
    description: str | None
    model_number: str | None
    firmware_version: str | None
    is_controllable: bool
    status: str
    last_seen_at: datetime | None
    reported_state: dict
