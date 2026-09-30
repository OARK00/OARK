import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator

# bcrypt only looks at the first 72 bytes of a password; anything longer
# would be silently cut (or refused by newer bcrypt), so it is refused here
# with a clear message instead.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_LENGTH = 8


def fits_bcrypt(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Use at most {MAX_PASSWORD_BYTES} bytes (about {MAX_PASSWORD_BYTES} plain characters).")
    return value


class RegisterRequest(BaseModel):
    org_name: str | None = None
    email: EmailStr
    # The same rules as changing it later, so sign-up can't create a password
    # the account would then be unable to change back to.
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)

    _password_fits_bcrypt = field_validator("password")(fits_bcrypt)


class LoginRequest(BaseModel):
    # No length rules here: an account made before the rules existed must
    # still be able to log in.
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH)

    _new_password_fits_bcrypt = field_validator("new_password")(fits_bcrypt)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
