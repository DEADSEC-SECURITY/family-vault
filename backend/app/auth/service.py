import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy.orm import Session as DBSession

from app.auth.models import Session, User
from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_session(db: DBSession, user_id: str) -> Session:
    token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.SESSION_EXPIRY_HOURS
    )
    session = Session(user_id=user_id, token=token, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_user_by_email(db: DBSession, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_token(db: DBSession, token: str) -> User | None:
    session = (
        db.query(Session)
        .filter(
            Session.token == token,
            Session.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not session:
        return None
    return session.user


def delete_session(db: DBSession, token: str) -> None:
    db.query(Session).filter(Session.token == token).delete()
    db.commit()
