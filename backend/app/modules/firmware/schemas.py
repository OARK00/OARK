from datetime import datetime

from pydantic import BaseModel, field_validator

from app.modules.firmware.sketch import clean_sketch


class SketchUpdate(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def code_is_storable(cls, code: str) -> str:
        return clean_sketch(code)


class SketchResponse(BaseModel):
    # None: nothing saved yet, the page shows the generated code.
    code: str | None
    updated_at: datetime | None
