import uuid
from datetime import datetime

from pydantic import BaseModel


class DeviceCreate(BaseModel):
    name: str
    category: str | None = None
    description: str | None = None
    is_controllable: bool = False


class DeviceCreateResponse(BaseModel):
    id: uuid.UUID
    name: str
    category: str | None
    description: str | None
    secret: str  # shown once at creation time, never again


class DeviceResponse(BaseModel):
    id: uuid.UUID
    name: str
    category: str | None
    description: str | None
    is_controllable: bool
    status: str
    last_seen_at: datetime | None
    reported_state: dict

    class Config:
        from_attributes = True
