from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


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
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(subject=str(user.id), org_id=str(user.org_id), role=user.role.value)
    return TokenResponse(access_token=token)
