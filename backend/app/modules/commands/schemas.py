import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CommandCreate(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    # Checked against the data point's type and limits, not here: whether 40
    # is acceptable depends on which field it is for.
    value: Any


class CommandResponse(BaseModel):
    id: uuid.UUID
    key: str
    value: Any
    status: str
    sent_by: str | None
    created_at: datetime
    expires_at: datetime
    delivered_at: datetime | None
    resolved_at: datetime | None
