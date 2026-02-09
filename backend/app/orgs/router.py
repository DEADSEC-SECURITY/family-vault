from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.auth.service import get_user_by_email
from app.database import get_db
from app.dependencies import get_current_user
from app.orgs.models import OrgMembership, Organization
from app.orgs.schemas import (
    OrgCreate,
    OrgMemberInvite,
    OrgMemberResponse,
    OrgMemberUpdate,
    OrgResponse,
    OrgUpdate,
)
from app.orgs.service import (
    create_organization,
    get_org_by_id,
    get_user_membership,
    get_user_orgs,
)

router = APIRouter(prefix="/api/orgs", tags=["organizations"])

VALID_ROLES = {"owner", "admin", "member", "viewer"}


def _require_role(membership: OrgMembership | None, min_role: str) -> OrgMembership:
    """Check that the user has at least the given role."""
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    role_order = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}
    if role_order.get(membership.role, 0) < role_order.get(min_role, 0):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return membership


def _org_to_response(org: Organization, include_members: bool = False) -> OrgResponse:
    resp = OrgResponse(
        id=org.id,
        name=org.name,
        created_by=org.created_by,
        created_at=org.created_at.isoformat(),
        updated_at=org.updated_at.isoformat(),
    )
    if include_members:
        resp.members = [
            OrgMemberResponse(
                id=m.id,
                user_id=m.user_id,
                email=m.user.email,
                full_name=m.user.full_name,
                role=m.role,
                created_at=m.created_at.isoformat(),
            )
            for m in org.memberships
        ]
    return resp


@router.get("", response_model=list[OrgResponse])
def list_orgs(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    orgs = get_user_orgs(db, user.id)
    return [_org_to_response(org) for org in orgs]


@router.post("", response_model=OrgResponse, status_code=201)
def create_org(
    data: OrgCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org = create_organization(db, name=data.name.strip(), created_by=user.id)
    return _org_to_response(org)


@router.get("/{org_id}", response_model=OrgResponse)
def get_org(
    org_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    membership = get_user_membership(db, user.id, org_id)
    _require_role(membership, "viewer")
    org = get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _org_to_response(org, include_members=True)


@router.put("/{org_id}", response_model=OrgResponse)
def update_org(
    org_id: str,
    data: OrgUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    membership = get_user_membership(db, user.id, org_id)
    _require_role(membership, "admin")
    org = get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.name = data.name.strip()
    db.commit()
    db.refresh(org)
    return _org_to_response(org)


@router.post("/{org_id}/invite", response_model=OrgMemberResponse, status_code=201)
def invite_member(
    org_id: str,
    data: OrgMemberInvite,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    membership = get_user_membership(db, user.id, org_id)
    _require_role(membership, "admin")

    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    if data.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot invite as owner")

    invite_user = get_user_by_email(db, data.email.lower().strip())
    if not invite_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = get_user_membership(db, invite_user.id, org_id)
    if existing:
        raise HTTPException(status_code=409, detail="User already a member")

    new_membership = OrgMembership(
        org_id=org_id,
        user_id=invite_user.id,
        role=data.role,
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    return OrgMemberResponse(
        id=new_membership.id,
        user_id=invite_user.id,
        email=invite_user.email,
        full_name=invite_user.full_name,
        role=new_membership.role,
        created_at=new_membership.created_at.isoformat(),
    )


@router.put("/{org_id}/members/{member_user_id}", response_model=OrgMemberResponse)
def update_member_role(
    org_id: str,
    member_user_id: str,
    data: OrgMemberUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    membership = get_user_membership(db, user.id, org_id)
    _require_role(membership, "admin")

    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    if data.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot assign owner role")

    target = get_user_membership(db, member_user_id, org_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner's role")

    target.role = data.role
    db.commit()
    db.refresh(target)

    return OrgMemberResponse(
        id=target.id,
        user_id=target.user_id,
        email=target.user.email,
        full_name=target.user.full_name,
        role=target.role,
        created_at=target.created_at.isoformat(),
    )


@router.delete("/{org_id}/members/{member_user_id}", status_code=204)
def remove_member(
    org_id: str,
    member_user_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    membership = get_user_membership(db, user.id, org_id)
    _require_role(membership, "admin")

    target = get_user_membership(db, member_user_id, org_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    db.delete(target)
    db.commit()
