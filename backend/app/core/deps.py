from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SESSION_COOKIE_NAME, decode_access_token
from app.models.user import User

# auto_error=False: a browser request carries no Authorization header at
# all, only the cookie below. Without this, a missing header would raise
# 401 here before the cookie fallback ever runs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    bearer_token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # A script or API client sends its own token in the header; the browser
    # sends only the httpOnly cookie it can't read or forge from JS.
    token = bearer_token or request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        raise credentials_error

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.get(User, user_id)
    if user is None:
        raise credentials_error
    return user
