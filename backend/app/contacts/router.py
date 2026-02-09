"""
contacts/router.py — FastAPI endpoints for linked contacts CRUD.

ENDPOINTS:
  GET    /api/contacts?item_id=      — list contacts for an item (sorted by sort_order)
  POST   /api/contacts               — create a contact (auto-composes value for addresses)
  PUT    /api/contacts/reorder       — bulk update sort_order for drag-to-reorder
  PATCH  /api/contacts/{contact_id}  — update label, value, type, or address fields
  DELETE /api/contacts/{contact_id}  — delete a contact

ADDRESS HANDLING:
  When contact_type="address", the endpoint:
  - Stores structured fields (address_line1..address_zip) in dedicated columns
  - Auto-composes `value` from parts: "Line1, Line2, City, State Zip"
  - On type change away from address, clears all address columns
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.contacts.models import ItemContact
from app.contacts.schemas import (
    ContactReorderRequest,
    ItemContactCreate,
    ItemContactOut,
    ItemContactUpdate,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.items.models import Item
from app.orgs.service import get_user_orgs

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def _compose_address_value(
    line1: str | None,
    line2: str | None,
    city: str | None,
    state: str | None,
    zip_code: str | None,
) -> str:
    """Build a human-readable address string from structured parts."""
    parts: list[str] = []
    if line1:
        parts.append(line1)
    if line2:
        parts.append(line2)
    city_state = ", ".join(filter(None, [city, state]))
    city_state_zip = " ".join(filter(None, [city_state, zip_code]))
    if city_state_zip:
        parts.append(city_state_zip)
    return ", ".join(parts) if parts else ""


def _get_active_org_id(user: User, db: DBSession) -> str:
    orgs = get_user_orgs(db, user.id)
    if not orgs:
        raise HTTPException(status_code=400, detail="No organization found")
    return orgs[0].id


@router.get("", response_model=list[ItemContactOut])
def list_contacts_for_item(
    item_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    contacts = (
        db.query(ItemContact)
        .filter(
            ItemContact.item_id == item_id,
            ItemContact.org_id == org_id,
        )
        .order_by(ItemContact.sort_order.asc(), ItemContact.created_at.asc())
        .all()
    )
    return contacts


@router.post("", status_code=201, response_model=ItemContactOut)
def create_contact(
    data: ItemContactCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)

    # Verify item belongs to user's org
    item = (
        db.query(Item)
        .filter(Item.id == data.item_id, Item.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # If no sort_order given, place at end
    if data.sort_order == 0:
        max_order = (
            db.query(ItemContact.sort_order)
            .filter(ItemContact.item_id == data.item_id)
            .order_by(ItemContact.sort_order.desc())
            .first()
        )
        data.sort_order = (max_order[0] + 1) if max_order else 0

    # For address type, auto-compose value from structured parts if value is empty
    value = data.value
    if data.contact_type == "address" and data.address_line1:
        value = _compose_address_value(
            data.address_line1, data.address_line2,
            data.address_city, data.address_state, data.address_zip,
        ) or value

    contact = ItemContact(
        item_id=data.item_id,
        org_id=org_id,
        label=data.label,
        value=value,
        contact_type=data.contact_type,
        sort_order=data.sort_order,
        address_line1=data.address_line1 if data.contact_type == "address" else None,
        address_line2=data.address_line2 if data.contact_type == "address" else None,
        address_city=data.address_city if data.contact_type == "address" else None,
        address_state=data.address_state if data.contact_type == "address" else None,
        address_zip=data.address_zip if data.contact_type == "address" else None,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/reorder", status_code=200)
def reorder_contacts(
    data: ContactReorderRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)

    # Verify item belongs to user's org
    item = (
        db.query(Item)
        .filter(Item.id == data.item_id, Item.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for entry in data.contacts:
        db.query(ItemContact).filter(
            ItemContact.id == entry.id,
            ItemContact.org_id == org_id,
        ).update({"sort_order": entry.sort_order})

    db.commit()
    return {"ok": True}


@router.patch("/{contact_id}", response_model=ItemContactOut)
def update_contact(
    contact_id: str,
    data: ItemContactUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    contact = (
        db.query(ItemContact)
        .filter(
            ItemContact.id == contact_id,
            ItemContact.org_id == org_id,
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if data.label is not None:
        contact.label = data.label
    if data.contact_type is not None:
        contact.contact_type = data.contact_type

    # Determine the effective contact type (might have just been updated)
    effective_type = contact.contact_type

    # Handle structured address fields
    if effective_type == "address":
        if data.address_line1 is not None:
            contact.address_line1 = data.address_line1
        if data.address_line2 is not None:
            contact.address_line2 = data.address_line2
        if data.address_city is not None:
            contact.address_city = data.address_city
        if data.address_state is not None:
            contact.address_state = data.address_state
        if data.address_zip is not None:
            contact.address_zip = data.address_zip

        # Auto-compose value from structured parts
        composed = _compose_address_value(
            contact.address_line1, contact.address_line2,
            contact.address_city, contact.address_state, contact.address_zip,
        )
        if composed:
            contact.value = composed
        elif data.value is not None:
            contact.value = data.value
    else:
        # Clear address fields if type is not address
        contact.address_line1 = None
        contact.address_line2 = None
        contact.address_city = None
        contact.address_state = None
        contact.address_zip = None
        if data.value is not None:
            contact.value = data.value

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    contact = (
        db.query(ItemContact)
        .filter(
            ItemContact.id == contact_id,
            ItemContact.org_id == org_id,
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(contact)
    db.commit()
