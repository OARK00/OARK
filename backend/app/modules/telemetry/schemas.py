import uuid
from datetime import datetime

from pydantic import BaseModel


class TelemetryReadingResponse(BaseModel):
    id: uuid.UUID
    data: dict
    recorded_at: datetime

    class Config:
        from_attributes = True
