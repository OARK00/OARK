import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AlertRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    condition: Literal["above", "below", "no_data"]
    device_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    data_key: str | None = Field(default=None, max_length=64)
    threshold: float | None = None
    for_minutes: int | None = Field(default=None, ge=1, le=60 * 24 * 7)
    cooldown_minutes: int = Field(default=15, ge=1, le=60 * 24)
    enabled: bool = True

    @model_validator(mode="after")
    def check_shape(self):
        """A rule that can never fire is worse than no rule, so the parts a
        condition needs are required at the door."""
        if self.condition == "no_data":
            if self.for_minutes is None:
                raise ValueError("A no-data rule needs for_minutes")
            self.data_key = None
            self.threshold = None
        else:
            if not self.data_key:
                raise ValueError(f"A {self.condition} rule needs data_key")
            if self.threshold is None:
                raise ValueError(f"A {self.condition} rule needs a threshold")
            self.for_minutes = None
        if self.device_id and self.product_id:
            raise ValueError("Choose one device or one product, not both")
        return self


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    threshold: float | None = None
    for_minutes: int | None = Field(default=None, ge=1, le=60 * 24 * 7)
    cooldown_minutes: int | None = Field(default=None, ge=1, le=60 * 24)
    enabled: bool | None = None


class AlertRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    condition: str
    device_id: uuid.UUID | None
    device_name: str | None
    product_id: uuid.UUID | None
    product_name: str | None
    data_key: str | None
    threshold: float | None
    for_minutes: int | None
    cooldown_minutes: int
    enabled: bool
    created_at: datetime | None


class AlertEventResponse(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    rule_name: str
    device_id: uuid.UUID
    device_name: str
    message: str
    value: float | None
    triggered_at: datetime
    acknowledged_at: datetime | None
