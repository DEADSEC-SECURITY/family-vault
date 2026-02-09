from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.auth.service import get_user_by_token
from app.database import get_db


def get_current_user(
    db: DBSession = Depends(get_db),
    authorization: str | None = Header(None),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    token = authorization[7:]
    user = get_user_by_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
        )
    return user
