import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEVICE_HASH_PREFIX = "sha256$"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, org_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "org_id": org_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def generate_device_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_device_secret(secret: str) -> str:
    """Plain SHA-256, unlike user passwords, which stay on bcrypt.

    bcrypt is slow on purpose so that stolen hashes of guessable human
    passwords can't be brute-forced. A device secret is 32 random bytes, so
    guessing is hopeless regardless of speed, and the 50ms bcrypt costs would
    be paid on every single telemetry message. Salting adds nothing here for
    the same reason: the input is already unique and unguessable.
    """
    return DEVICE_HASH_PREFIX + hashlib.sha256(secret.encode()).hexdigest()


def verify_device_secret(provided: str, stored_hash: str) -> bool:
    """Constant-time check; falls back to bcrypt for devices created before
    hash_device_secret existed."""
    if not stored_hash.startswith(DEVICE_HASH_PREFIX):
        return pwd_context.verify(provided, stored_hash)
    expected = hashlib.sha256(provided.encode()).hexdigest()
    return hmac.compare_digest(expected, stored_hash[len(DEVICE_HASH_PREFIX) :])
