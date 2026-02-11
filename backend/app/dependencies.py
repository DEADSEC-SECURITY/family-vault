from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.auth.service import get_user_by_token
from app.database import get_db
from app.items.models import Item


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


def verify_item_ownership(
    db: DBSession,
    item_id: str,
    org_id: str,
    *,
    allow_archived: bool = True,
) -> Item:
    """Verify an item exists and belongs to the given org. Returns the item or raises 404."""
    query = db.query(Item).filter(Item.id == item_id, Item.org_id == org_id)
    if not allow_archived:
        query = query.filter(Item.is_archived == False)  # noqa: E712
    item = query.first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item
