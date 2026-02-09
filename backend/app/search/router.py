from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user
from app.items.schemas import ItemListResponse
from app.orgs.service import get_user_orgs
from app.search.service import search_items

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=ItemListResponse)
def search(
    q: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    orgs = get_user_orgs(db, user.id)
    if not orgs:
        raise HTTPException(status_code=400, detail="No organization found")

    items = search_items(db, orgs[0].id, q)
    return ItemListResponse(items=items, total=len(items), page=1, limit=50)
