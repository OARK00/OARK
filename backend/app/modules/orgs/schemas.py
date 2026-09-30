import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime | None


class OrganizationUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The company name can't be empty.")
        return value
