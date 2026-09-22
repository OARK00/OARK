from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.modules.auth.rate_limit import (
    clear_failures,
    client_ip,
    count_email_failures,
    count_ip_failures,
    is_rate_limited,
    record_failure,
    retry_after_seconds,
)
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

# Checked against when the email doesn't exist, so that answering "no such
# user" takes as long as answering "wrong password". Without it, response
# time alone tells an attacker which emails are registered.
DUMMY_PASSWORD_HASH = hash_password("oark-dummy-password-never-valid")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    org_name = payload.org_name or f"{payload.email.split('@')[0]}'s workspace"
    org = Organization(name=org_name)
    db.add(org)
    db.flush()

    user = User(
        org_id=org.id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.owner,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), org_id=str(user.org_id), role=user.role.value)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    if is_rate_limited(count_email_failures(db, payload.email), count_ip_failures(db, ip)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait and try again.",
            headers={"Retry-After": str(retry_after_seconds(db, payload.email, ip))},
        )

    user = db.query(User).filter(User.email == payload.email).first()
    password_ok = verify_password(payload.password, user.hashed_password if user else DUMMY_PASSWORD_HASH)

    if not user or not password_ok:
        record_failure(db, payload.email, ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # A correct password means the earlier failures were the owner fumbling.
    clear_failures(db, payload.email)
    token = create_access_token(subject=str(user.id), org_id=str(user.org_id), role=user.role.value)
    return TokenResponse(access_token=token)
