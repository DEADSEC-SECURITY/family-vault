"""
people/router.py — FastAPI endpoints for org-wide people database.

ENDPOINTS:
  GET    /api/people              — list all people for user's org
  GET    /api/people/{person_id}  — get a single person
  POST   /api/people              — create a new person
  PATCH  /api/people/{person_id}  — update person details
  DELETE /api/people/{person_id}  — delete person
  POST   /api/people/{person_id}/resend-invite — resend invitation email
  GET    /api/people/{person_id}/invite-link  — get active invitation link

People are org-scoped. They can be referenced throughout the app for beneficiaries,
insured persons, etc. People can optionally have login access via a linked user account.

When can_login is set to True for a person with an email and no linked user account,
an invitation email is automatically sent so they can set up a password.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user, verify_item_ownership
from datetime import datetime, timezone

from app.config import settings
from app.invitations.models import InvitationToken
from app.invitations.service import create_invitation, send_invitation_email
from app.orgs.models import Organization
from app.orgs.service import get_active_org_id
from app.people.models import ItemPerson, Person
from app.people.schemas import (
    LinkedPersonOut,
    LinkPersonRequest,
    PersonCreate,
    PersonOut,
    PersonUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/people", tags=["people"])


def _maybe_send_invite(db: DBSession, person: Person, org_id: str) -> None:
    """Send an invitation if person needs one (can_login=True, has email, no user_id)."""
    if not person.can_login or person.user_id or not person.email:
        return
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        return
    token_obj = create_invitation(db, person, org_id)
    db.commit()
    send_invitation_email(person, token_obj.token, org.name)
    logger.info("Invitation sent to %s for org %s", person.email, org.name)


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
    """Create a new person in the user's org.

    If can_login is True and the person has an email, an invitation email is sent.
    """
    org_id = get_active_org_id(user, db)

    if data.can_login and not data.email:
        raise HTTPException(
            status_code=400,
            detail="Email is required to grant login access",
        )

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
        encryption_version=data.encryption_version,
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    _maybe_send_invite(db, person, org_id)

    return person


@router.patch("/{person_id}", response_model=PersonOut)
def update_person(
    person_id: str,
    data: PersonUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Update a person's details.

    If can_login transitions to True for a person with email and no linked user,
    an invitation email is sent automatically.
    """
    org_id = get_active_org_id(user, db)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    old_can_login = person.can_login

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
        if data.can_login and not person.email:
            raise HTTPException(
                status_code=400,
                detail="Email is required to grant login access",
            )
        person.can_login = data.can_login
    if data.encryption_version is not None:
        person.encryption_version = data.encryption_version

    db.commit()
    db.refresh(person)

    # Send invite if can_login was just turned on and no user linked
    if not old_can_login and person.can_login and not person.user_id:
        _maybe_send_invite(db, person, org_id)

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


# ── Invitation management ───────────────────────────────────────


@router.post("/{person_id}/resend-invite")
def resend_invite(
    person_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Resend an invitation email for a person with status 'invited'."""
    org_id = get_active_org_id(user, db)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if not person.can_login:
        raise HTTPException(status_code=400, detail="Person does not have login access enabled")
    if person.user_id:
        raise HTTPException(status_code=400, detail="Person already has an active account")
    if not person.email:
        raise HTTPException(status_code=400, detail="Person has no email address")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    token_obj = create_invitation(db, person, org_id)
    db.commit()
    send_invitation_email(person, token_obj.token, org.name)

    return {"message": f"Invitation resent to {person.email}"}


@router.get("/{person_id}/invite-link")
def get_invite_link(
    person_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get the active invitation link for a person with status 'invited'."""
    org_id = get_active_org_id(user, db)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.org_id == org_id)
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    token_obj = (
        db.query(InvitationToken)
        .filter(
            InvitationToken.person_id == person_id,
            InvitationToken.purpose == "invite",
            InvitationToken.used_at.is_(None),
            InvitationToken.expires_at > datetime.now(timezone.utc),
        )
        .order_by(InvitationToken.created_at.desc())
        .first()
    )
    if not token_obj:
        raise HTTPException(status_code=404, detail="No active invitation found")

    invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={token_obj.token}"
    return {"invite_url": invite_url}


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
                    encryption_version=person.encryption_version,
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
        encryption_version=person.encryption_version,
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
