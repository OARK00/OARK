import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

NO_PROTECTED_NAMESPACES = ConfigDict(protected_namespaces=())

MAX_DATA_POINTS = 50
MAX_OPTIONS = 8
MAX_OPTION_LENGTH = 32

# ESP32 GPIOs a data point may use. Left out: 6-11 (wired to the flash chip;
# using them crashes the board) and 1 and 3 (the USB serial line: the serial
# monitor and uploading need them).
USABLE_PINS = frozenset({0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39})
# These have no output driver: they can only read.
INPUT_ONLY_PINS = frozenset({34, 35, 36, 39})
# Analog readings while Wi-Fi is on: only the ADC1 pins work. The other
# analog unit (ADC2) is taken over by the Wi-Fi radio.
ANALOG_PINS = frozenset({32, 33, 34, 35, 36, 39})

PinKind = Literal["output", "input", "analog"]


def pin_kind(type_: str, access: str) -> PinKind | None:
    """What a pin would do for this data point, or None if it cannot have one."""
    if type_ == "boolean":
        return "output" if access == "write" else "input"
    if type_ == "number" and access == "read":
        return "analog"
    return None


def pin_problem(kind: PinKind, pin: int) -> str | None:
    """Why `pin` cannot be used this way on an ESP32, or None if it can."""
    if pin not in USABLE_PINS:
        return f"GPIO {pin} can't be used on an ESP32 board"
    if kind == "output" and pin in INPUT_ONLY_PINS:
        return f"GPIO {pin} can only read, so it cannot switch anything"
    if kind == "analog" and pin not in ANALOG_PINS:
        return f"GPIO {pin} stops reading numbers when Wi-Fi is on; use GPIO 32-39"
    return None


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
    # The ESP32 GPIO this data point is wired to, so the generated code can
    # read or switch it. One wiring per product: every unit is built alike.
    pin: int | None = None
    # Outputs only: the board switches on when the pin is LOW (many relay boards).
    active_low: bool = False

    @model_validator(mode="after")
    def pin_fits_the_data_point(self):
        kind = pin_kind(self.type, self.access)
        if kind != "output":
            self.active_low = False
        if self.pin is None:
            return self
        if kind is None:
            raise ValueError(f"{self.label}: only on/off fields and number readings can use a GPIO")
        problem = pin_problem(kind, self.pin)
        if problem:
            raise ValueError(f"{self.label}: {problem}")
        return self

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
    pins: dict[int, str] = {}
    for point in points:
        if point.key in seen:
            raise ValueError(f'Two data points use the key "{point.key}"')
        seen.add(point.key)
        # One wire per pin: two data points on one GPIO would fight over it.
        if point.pin is not None:
            if point.pin in pins:
                raise ValueError(f"{pins[point.pin]} and {point.label} both use GPIO {point.pin}")
            pins[point.pin] = point.label
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
