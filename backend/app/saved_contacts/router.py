"""
saved_contacts/router.py — FastAPI endpoints for global contacts directory + per-item linking.

CRUD ENDPOINTS:
  GET    /api/saved-contacts              — list all saved contacts for user's org
  GET    /api/saved-contacts/{id}         — get a single saved contact
  POST   /api/saved-contacts              — create a new saved contact
  PATCH  /api/saved-contacts/{id}         — update a saved contact
  DELETE /api/saved-contacts/{id}         — delete (cascades junction rows)

LINKING ENDPOINTS:
  GET    /api/saved-contacts/item/{item_id}       — list saved contacts linked to an item
  POST   /api/saved-contacts/item/{item_id}       — link a saved contact to an item
  DELETE /api/saved-contacts/item/{item_id}/{id}   — unlink saved contact from item
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user, verify_item_ownership
from app.orgs.service import get_active_org_id
from app.saved_contacts.models import ItemSavedContact, SavedContact
from app.saved_contacts.schemas import (
    LinkedSavedContactOut,
    LinkSavedContactRequest,
    SavedContactCreate,
    SavedContactOut,
    SavedContactUpdate,
)

router = APIRouter(prefix="/api/saved-contacts", tags=["saved-contacts"])


# ── CRUD ─────────────────────────────────────────────────────────


@router.get("", response_model=list[SavedContactOut])
def list_saved_contacts(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List all saved contacts for the user's org."""
    org_id = get_active_org_id(user, db)
    return (
        db.query(SavedContact)
        .filter(SavedContact.org_id == org_id)
        .order_by(SavedContact.name.asc())
        .all()
    )


@router.get("/{contact_id}", response_model=SavedContactOut)
def get_saved_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get a single saved contact by ID."""
    org_id = get_active_org_id(user, db)
    contact = (
        db.query(SavedContact)
        .filter(SavedContact.id == contact_id, SavedContact.org_id == org_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Saved contact not found")
    return contact


@router.post("", status_code=201, response_model=SavedContactOut)
def create_saved_contact(
    data: SavedContactCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Create a new saved contact in the user's org."""
    org_id = get_active_org_id(user, db)
    contact = SavedContact(
        org_id=org_id,
        name=data.name,
        company=data.company,
        role=data.role,
        email=data.email,
        phone=data.phone,
        website=data.website,
        address=data.address,
        notes=data.notes,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=SavedContactOut)
def update_saved_contact(
    contact_id: str,
    data: SavedContactUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Update a saved contact's details."""
    org_id = get_active_org_id(user, db)
    contact = (
        db.query(SavedContact)
        .filter(SavedContact.id == contact_id, SavedContact.org_id == org_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Saved contact not found")

    for field in ("name", "company", "role", "email", "phone", "website", "address", "notes"):
        value = getattr(data, field, None)
        if value is not None:
            setattr(contact, field, value)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_saved_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Delete a saved contact. Cascades to item_saved_contacts."""
    org_id = get_active_org_id(user, db)
    contact = (
        db.query(SavedContact)
        .filter(SavedContact.id == contact_id, SavedContact.org_id == org_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Saved contact not found")

    db.delete(contact)
    db.commit()


# ── Per-item linking ─────────────────────────────────────────────


@router.get("/item/{item_id}", response_model=list[LinkedSavedContactOut])
def list_item_saved_contacts(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List saved contacts linked to a specific item."""
    org_id = get_active_org_id(user, db)
    verify_item_ownership(db, item_id, org_id)

    links = (
        db.query(ItemSavedContact)
        .filter(
            ItemSavedContact.item_id == item_id,
            ItemSavedContact.org_id == org_id,
        )
        .order_by(ItemSavedContact.created_at.asc())
        .all()
    )

    result = []
    for link in links:
        contact = (
            db.query(SavedContact)
            .filter(SavedContact.id == link.saved_contact_id)
            .first()
        )
        if contact:
            result.append(
                LinkedSavedContactOut(
                    id=link.id,
                    saved_contact_id=contact.id,
                    item_id=item_id,
                    name=contact.name,
                    company=contact.company,
                    role=contact.role,
                    email=contact.email,
                    phone=contact.phone,
                    website=contact.website,
                    created_at=link.created_at,
                )
            )
    return result


@router.post("/item/{item_id}", status_code=201, response_model=LinkedSavedContactOut)
def link_saved_contact(
    item_id: str,
    data: LinkSavedContactRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Link a saved contact to an item."""
    org_id = get_active_org_id(user, db)
    verify_item_ownership(db, item_id, org_id)

    # Verify saved contact exists and belongs to org
    contact = (
        db.query(SavedContact)
        .filter(SavedContact.id == data.saved_contact_id, SavedContact.org_id == org_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Saved contact not found")

    # Check for existing link
    existing = (
        db.query(ItemSavedContact)
        .filter(
            ItemSavedContact.item_id == item_id,
            ItemSavedContact.saved_contact_id == data.saved_contact_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Contact already linked to this item")

    link = ItemSavedContact(
        item_id=item_id,
        saved_contact_id=data.saved_contact_id,
        org_id=org_id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return LinkedSavedContactOut(
        id=link.id,
        saved_contact_id=contact.id,
        item_id=item_id,
        name=contact.name,
        company=contact.company,
        role=contact.role,
        email=contact.email,
        phone=contact.phone,
        website=contact.website,
        created_at=link.created_at,
    )


@router.delete("/item/{item_id}/{link_id}", status_code=204)
def unlink_saved_contact(
    item_id: str,
    link_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Unlink a saved contact from an item."""
    org_id = get_active_org_id(user, db)
    link = (
        db.query(ItemSavedContact)
        .filter(
            ItemSavedContact.id == link_id,
            ItemSavedContact.item_id == item_id,
            ItemSavedContact.org_id == org_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()
