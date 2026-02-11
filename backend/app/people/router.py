"""
people/router.py — FastAPI endpoints for org-wide people database.

ENDPOINTS:
  GET    /api/people              — list all people for user's org
  GET    /api/people/{person_id}  — get a single person
  POST   /api/people              — create a new person
  PATCH  /api/people/{person_id}  — update person details
  DELETE /api/people/{person_id}  — delete person

People are org-scoped. They can be referenced throughout the app for beneficiaries,
insured persons, etc. People can optionally have login access via a linked user account.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user, verify_item_ownership
from app.orgs.service import get_active_org_id
from app.people.models import ItemPerson, Person
from app.people.schemas import (
    LinkedPersonOut,
    LinkPersonRequest,
    PersonCreate,
    PersonOut,
    PersonUpdate,
)

router = APIRouter(prefix="/api/people", tags=["people"])


@router.get("", response_model=list[PersonOut])
def list_people(
    page: int = 1,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List all people in the user's org."""
    org_id = get_active_org_id(user, db)
    offset = (max(page, 1) - 1) * limit
    people = (
        db.query(Person)
        .filter(Person.org_id == org_id)
        .order_by(Person.last_name.asc(), Person.first_name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return people


@router.get("/{person_id}", response_model=PersonOut)
def get_person(
    person_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get a single person by ID."""
    org_id = get_active_org_id(user, db)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.post("", status_code=201, response_model=PersonOut)
def create_person(
    data: PersonCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Create a new person in the user's org."""
    org_id = get_active_org_id(user, db)
    person = Person(
        org_id=org_id,
        first_name=data.first_name,
        last_name=data.last_name,
        photo_url=data.photo_url,
        date_of_birth=data.date_of_birth,
        email=data.email,
        phone=data.phone,
        relationship=data.relationship,
        notes=data.notes,
        can_login=data.can_login,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@router.patch("/{person_id}", response_model=PersonOut)
def update_person(
    person_id: str,
    data: PersonUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Update a person's details."""
    org_id = get_active_org_id(user, db)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Update fields if provided
    if data.first_name is not None:
        person.first_name = data.first_name
    if data.last_name is not None:
        person.last_name = data.last_name
    if data.photo_url is not None:
        person.photo_url = data.photo_url
    if data.date_of_birth is not None:
        person.date_of_birth = data.date_of_birth
    if data.email is not None:
        person.email = data.email
    if data.phone is not None:
        person.phone = data.phone
    if data.relationship is not None:
        person.relationship = data.relationship
    if data.notes is not None:
        person.notes = data.notes
    if data.can_login is not None:
        person.can_login = data.can_login

    db.commit()
    db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=204)
def delete_person(
    person_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Delete a person from the org."""
    org_id = get_active_org_id(user, db)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    db.delete(person)
    db.commit()


# ── Per-item linking ─────────────────────────────────────────────


@router.get("/item/{item_id}", response_model=list[LinkedPersonOut])
def list_item_people(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List people linked to a specific item."""
    org_id = get_active_org_id(user, db)
    verify_item_ownership(db, item_id, org_id)

    links = (
        db.query(ItemPerson)
        .filter(ItemPerson.item_id == item_id, ItemPerson.org_id == org_id)
        .order_by(ItemPerson.created_at.asc())
        .all()
    )

    result = []
    for link in links:
        person = (
            db.query(Person)
            .filter(Person.id == link.person_id)
            .first()
        )
        if person:
            result.append(
                LinkedPersonOut(
                    id=link.id,
                    person_id=person.id,
                    item_id=item_id,
                    role=link.role,
                    first_name=person.first_name,
                    last_name=person.last_name,
                    email=person.email,
                    phone=person.phone,
                    relationship=person.relationship,
                    created_at=link.created_at,
                )
            )
    return result


@router.post("/item/{item_id}", status_code=201, response_model=LinkedPersonOut)
def link_person(
    item_id: str,
    data: LinkPersonRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Link a person to an item with an optional role."""
    org_id = get_active_org_id(user, db)
    verify_item_ownership(db, item_id, org_id)

    # Verify person exists and belongs to org
    person = (
        db.query(Person)
        .filter(Person.id == data.person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Check for existing link with same role
    existing = (
        db.query(ItemPerson)
        .filter(
            ItemPerson.item_id == item_id,
            ItemPerson.person_id == data.person_id,
            ItemPerson.role == data.role,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Person already linked with this role")

    link = ItemPerson(
        item_id=item_id,
        person_id=data.person_id,
        role=data.role,
        org_id=org_id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return LinkedPersonOut(
        id=link.id,
        person_id=person.id,
        item_id=item_id,
        role=link.role,
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        phone=person.phone,
        relationship=person.relationship,
        created_at=link.created_at,
    )


@router.delete("/item/{item_id}/{link_id}", status_code=204)
def unlink_person(
    item_id: str,
    link_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Unlink a person from an item."""
    org_id = get_active_org_id(user, db)
    link = (
        db.query(ItemPerson)
        .filter(
            ItemPerson.id == link_id,
            ItemPerson.item_id == item_id,
            ItemPerson.org_id == org_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()
