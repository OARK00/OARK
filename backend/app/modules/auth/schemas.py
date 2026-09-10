import uuid

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    org_name: str | None = None
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
