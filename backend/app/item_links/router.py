"""
item_links/router.py — Endpoints for item-to-item linking.

ENDPOINTS:
  GET    /api/item-links/children/{parent_item_id}?link_type=  — list children
  GET    /api/item-links/parent/{child_item_id}?link_type=     — get parent
  POST   /api/item-links/{child_item_id}                       — create link
  DELETE /api/item-links/{child_item_id}?link_type=            — remove link
"""
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user, verify_item_ownership
from app.items.models import Item, ItemFieldValue
from app.item_links.models import ItemLink
from app.item_links.schemas import LinkedChildOut, LinkedParentOut, LinkItemRequest
from app.orgs.service import get_active_org_id

router = APIRouter(prefix="/api/item-links", tags=["item-links"])

BUSINESS_ENTITY_SUBCATEGORIES = {"llc", "corporation", "partnership", "sole_proprietorship"}
LINKABLE_CHILD_SUBCATEGORIES = {
    "business_license", "tax_document",
    # Business insurance types
    "general_liability", "professional_liability", "workers_compensation",
    "commercial_property", "commercial_auto", "bop", "cyber_liability",
    "other_business_insurance",
}


@router.get("/children/{parent_item_id}", response_model=list[LinkedChildOut])
def list_children(
    parent_item_id: str,
    link_type: str = "business_license",
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List child items linked to a parent item."""
    org_id = get_active_org_id(user, db)
    verify_item_ownership(db, parent_item_id, org_id)

    links = (
        db.query(ItemLink)
        .filter(
            ItemLink.parent_item_id == parent_item_id,
            ItemLink.link_type == link_type,
            ItemLink.org_id == org_id,
        )
        .all()
    )

    result = []
    for link in links:
        child = db.query(Item).filter(Item.id == link.child_item_id).first()
        if not child:
            continue

        # Get key field values for preview
        field_vals = {
            fv.field_key: fv.field_value
            for fv in db.query(ItemFieldValue)
            .filter(ItemFieldValue.item_id == child.id)
            .all()
        }

        result.append(
            LinkedChildOut(
                id=link.id,
                item_id=child.id,
                name=child.name,
                subcategory=child.subcategory,
                is_archived=child.is_archived,
                license_type=field_vals.get("license_type"),
                expiration_date=field_vals.get("expiration_date") or field_vals.get("end_date"),
                issuing_authority=field_vals.get("issuing_authority"),
                provider=field_vals.get("provider"),
                coverage_type=field_vals.get("coverage_type"),
                premium=field_vals.get("premium"),
                document_type=field_vals.get("document_type"),
                tax_year=field_vals.get("tax_year"),
                created_at=link.created_at,
            )
        )

    return result


@router.get("/parent/{child_item_id}", response_model=LinkedParentOut | None)
def get_parent(
    child_item_id: str,
    link_type: str = "business_license",
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get the parent item linked to a child item."""
    org_id = get_active_org_id(user, db)
    verify_item_ownership(db, child_item_id, org_id)

    link = (
        db.query(ItemLink)
        .filter(
            ItemLink.child_item_id == child_item_id,
            ItemLink.link_type == link_type,
            ItemLink.org_id == org_id,
        )
        .first()
    )
    if not link:
        return None

    parent = db.query(Item).filter(Item.id == link.parent_item_id).first()
    if not parent:
        return None

    return LinkedParentOut(
        id=link.id,
        item_id=parent.id,
        name=parent.name,
        subcategory=parent.subcategory,
        is_archived=parent.is_archived,
    )


@router.post("/{child_item_id}", status_code=201, response_model=LinkedParentOut)
def link_items(
    child_item_id: str,
    data: LinkItemRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Link a child item to a parent item."""
    org_id = get_active_org_id(user, db)

    # Verify both items exist and belong to same org
    child = verify_item_ownership(db, child_item_id, org_id)
    parent = verify_item_ownership(db, data.parent_item_id, org_id)

    # Validate subcategories
    if parent.subcategory not in BUSINESS_ENTITY_SUBCATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Parent item must be a business entity ({', '.join(sorted(BUSINESS_ENTITY_SUBCATEGORIES))})",
        )
    if child.subcategory not in LINKABLE_CHILD_SUBCATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Child item must be a linkable type ({', '.join(sorted(LINKABLE_CHILD_SUBCATEGORIES))})",
        )

    # Check for existing link
    existing = (
        db.query(ItemLink)
        .filter(
            ItemLink.child_item_id == child_item_id,
            ItemLink.link_type == data.link_type,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="This item is already linked to a business")

    link = ItemLink(
        parent_item_id=data.parent_item_id,
        child_item_id=child_item_id,
        link_type=data.link_type,
        org_id=org_id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return LinkedParentOut(
        id=link.id,
        item_id=parent.id,
        name=parent.name,
        subcategory=parent.subcategory,
        is_archived=parent.is_archived,
    )


@router.delete("/{child_item_id}", status_code=204)
def unlink_items(
    child_item_id: str,
    link_type: str = "business_license",
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Remove a link between items."""
    org_id = get_active_org_id(user, db)

    link = (
        db.query(ItemLink)
        .filter(
            ItemLink.child_item_id == child_item_id,
            ItemLink.link_type == link_type,
            ItemLink.org_id == org_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()
