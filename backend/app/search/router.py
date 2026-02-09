from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user
from app.items.schemas import ItemListResponse
from app.orgs.service import get_active_org_id
from app.search.service import search_items

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=ItemListResponse)
def search(
    q: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    items = search_items(db, org_id, q)
    return ItemListResponse(items=items, total=len(items), page=1, limit=50)
