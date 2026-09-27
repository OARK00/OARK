import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

NO_PROTECTED_NAMESPACES = ConfigDict(protected_namespaces=())

MAX_DATA_POINTS = 50
MAX_OPTIONS = 8
MAX_OPTION_LENGTH = 32


class DataPoint(BaseModel):
    # Must match the device's telemetry field name exactly, so no pattern:
    # a device may send "temp-1" or "Temp C".
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=64)
    type: Literal["number", "boolean", "string"]
    unit: str | None = Field(default=None, max_length=16)
    min: float | None = None
    max: float | None = None
    # "read": the device reports it. "write": it can also be controlled.
    access: Literal["read", "write"] = "read"
    # "buttons": a controllable text field shown as one button per allowed
    # value (forward / reverse / stop), instead of a free text box.
    widget: Literal["buttons"] | None = None
    # The only values a command may set on a text field. None: any text.
    options: list[str] | None = Field(default=None, max_length=MAX_OPTIONS)
    # Buttons only: sent when a button is let go, so a car moves only while
    # its button is held. None: a press is a single tap.
    release_value: str | None = None

    @model_validator(mode="after")
    def limits_only_for_numbers(self):
        if self.type != "number":
            self.unit = None
            self.min = None
            self.max = None
        elif self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError(f"{self.label}: minimum is higher than maximum")
        return self

    @model_validator(mode="after")
    def options_only_for_text(self):
        if self.type != "string":
            if self.widget == "buttons":
                raise ValueError(f"{self.label}: buttons need a text field")
            self.options = None
            self.release_value = None
            return self

        if self.options is not None:
            cleaned = [option.strip() for option in self.options]
            if any(not option or len(option) > MAX_OPTION_LENGTH for option in cleaned):
                raise ValueError(f"{self.label}: each value needs 1 to {MAX_OPTION_LENGTH} characters")
            if len(set(cleaned)) != len(cleaned):
                raise ValueError(f"{self.label}: the same value is listed twice")
            self.options = cleaned or None

        if self.widget == "buttons":
            if self.access != "write":
                raise ValueError(f"{self.label}: buttons are for fields Oark can control")
            if not self.options:
                raise ValueError(f"{self.label}: buttons need at least one value")
        else:
            self.release_value = None

        if self.release_value is not None and self.release_value not in (self.options or []):
            raise ValueError(f"{self.label}: the value sent on release must be one of the buttons")
        return self


def ensure_unique_keys(points: list[DataPoint]) -> list[DataPoint]:
    seen = set()
    for point in points:
        if point.key in seen:
            raise ValueError(f'Two data points use the key "{point.key}"')
        seen.add(point.key)
    return points


class ProductCreate(BaseModel):
    model_config = NO_PROTECTED_NAMESPACES

    name: str = Field(min_length=1, max_length=80)
    category: str | None = None
    description: str | None = None
    model_number: str | None = None


class DataPointsUpdate(BaseModel):
    data_points: Annotated[
        list[DataPoint],
        Field(max_length=MAX_DATA_POINTS),
        AfterValidator(ensure_unique_keys),
    ]


class ProductResponse(BaseModel):
    model_config = NO_PROTECTED_NAMESPACES

    id: uuid.UUID
    name: str
    category: str | None
    description: str | None
    model_number: str | None
    data_points: list[DataPoint]
    device_count: int
    created_at: datetime | None


class SuggestedDataPoint(DataPoint):
    defined: bool  # already part of the product's saved definition
    sample_count: int
    last_value: Any = None
    observed_min: float | None = None
    observed_max: float | None = None


class SuggestionsResponse(BaseModel):
    reading_count: int
    device_count: int
    data_points: list[SuggestedDataPoint]
