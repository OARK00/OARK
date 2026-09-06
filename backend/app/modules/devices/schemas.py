import uuid
from datetime import datetime

from pydantic import BaseModel


class DeviceCreate(BaseModel):
    name: str
    is_controllable: bool = False


class DeviceCreateResponse(BaseModel):
    id: uuid.UUID
    name: str
    secret: str  # shown once at creation time, never again


class DeviceResponse(BaseModel):
    id: uuid.UUID
    name: str
    is_controllable: bool
    status: str
    last_seen_at: datetime | None
    reported_state: dict

    class Config:
        from_attributes = True
