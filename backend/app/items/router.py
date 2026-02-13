from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user
from app.files.models import FileAttachment
from app.items.models import Item
from app.items.schemas import ItemCreate, ItemListResponse, ItemResponse, ItemUpdate
from app.items.service import create_item, delete_item, get_item, list_items, renew_item, update_item
from app.orgs.service import get_active_org_id

router = APIRouter(prefix="/api/items", tags=["items"])


@router.get("", response_model=ItemListResponse)
def list_items_endpoint(
    category: str | None = None,
    subcategory: str | None = None,
    page: int = 1,
    limit: int = 50,
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    items, total = list_items(db, org_id, category, subcategory, page, limit, include_archived)
    return ItemListResponse(items=items, total=total, page=page, limit=limit)


@router.get("/migration/status")
def migration_status(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return counts of v1 vs v2 items and files for the current org."""
    org_id = get_active_org_id(user, db)

    items_v1 = db.query(func.count(Item.id)).filter(
        Item.org_id == org_id, Item.is_archived == False, Item.encryption_version != 2
    ).scalar() or 0
    items_v2 = db.query(func.count(Item.id)).filter(
        Item.org_id == org_id, Item.is_archived == False, Item.encryption_version == 2
    ).scalar() or 0

    files_v1 = (
        db.query(func.count(FileAttachment.id))
        .join(Item)
        .filter(Item.org_id == org_id, FileAttachment.encryption_version != 2)
        .scalar() or 0
    )
    files_v2 = (
        db.query(func.count(FileAttachment.id))
        .join(Item)
        .filter(Item.org_id == org_id, FileAttachment.encryption_version == 2)
        .scalar() or 0
    )

    return {
        "items_v1": items_v1,
        "items_v2": items_v2,
        "files_v1": files_v1,
        "files_v2": files_v2,
    }


@router.post("", response_model=ItemResponse, status_code=201)
def create_item_endpoint(
    data: ItemCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    return create_item(
        db,
        org_id=org_id,
        user_id=user.id,
        category=data.category,
        subcategory=data.subcategory,
        name=data.name,
        notes=data.notes,
        fields=data.fields,
        encryption_version=data.encryption_version,
    )


@router.get("/{item_id}", response_model=ItemResponse)
def get_item_endpoint(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    return get_item(db, item_id, org_id, include_archived=True)


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item_endpoint(
    item_id: str,
    data: ItemUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    return update_item(db, item_id, org_id, data.name, data.notes, data.fields, data.encryption_version)


@router.delete("/{item_id}", status_code=204)
def delete_item_endpoint(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    delete_item(db, item_id, org_id)


@router.post("/{item_id}/renew", response_model=ItemResponse, status_code=201)
def renew_item_endpoint(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    return renew_item(db, item_id, org_id, user.id)
