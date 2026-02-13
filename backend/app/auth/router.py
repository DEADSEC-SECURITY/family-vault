from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession
from uuid import uuid4

from app.auth.models import User
from app.auth.schemas import (
    AcceptInviteRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    InviteValidation,
    OrgKeyExchange,
    PendingKeyMember,
    PreloginRequest,
    PreloginResponse,
    ResetPasswordRequest,
    ResetValidation,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.auth.service import (
    create_session,
    delete_session,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.invitations.service import (
    accept_invitation,
    create_password_reset,
    reset_password,
    send_password_reset_email,
    validate_invite_token,
    validate_reset_token,
)
from app.orgs.models import OrgMemberKey, OrgMembership, Organization
from app.orgs.service import create_organization, get_active_org_id, get_user_orgs
from app.people.models import Person

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Pre-login (public) ────────────────────────────────────────────


@router.post("/prelogin", response_model=PreloginResponse)
def prelogin(data: PreloginRequest, db: DBSession = Depends(get_db)):
    """Return KDF iterations for a given email so the client can derive keys.

    Always returns a response (even for unknown emails) to prevent enumeration.
    """
    user = get_user_by_email(db, data.email.lower().strip())
    kdf_iterations = user.kdf_iterations if user else 600000
    return PreloginResponse(
        kdf_iterations=kdf_iterations,
        email=data.email.lower().strip(),
    )


# ── Register ──────────────────────────────────────────────────────


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserCreate, db: DBSession = Depends(get_db)):
    existing = get_user_by_email(db, data.email.lower().strip())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Zero-knowledge mode: client sends master_password_hash instead of raw password
    is_zk = data.master_password_hash is not None
    auth_value = data.master_password_hash if is_zk else data.password

    user = User(
        email=data.email.lower().strip(),
        password_hash=hash_password(auth_value),
        full_name=data.full_name.strip(),
        encrypted_private_key=data.encrypted_private_key,
        public_key=data.public_key,
        kdf_iterations=data.kdf_iterations or 600000,
        recovery_encrypted_private_key=data.recovery_encrypted_private_key,
    )
    db.add(user)
    db.flush()

    # Auto-create personal organization
    org = create_organization(
        db, name=f"{user.full_name}'s Vault", created_by=user.id
    )

    # Store the client-wrapped org key if provided
    if is_zk and data.encrypted_org_key:
        org_member_key = OrgMemberKey(
            org_id=org.id,
            user_id=user.id,
            encrypted_org_key=data.encrypted_org_key,
        )
        db.add(org_member_key)
        db.flush()

    # Auto-create person record for the user
    name_parts = user.full_name.strip().split(maxsplit=1)
    first_name = name_parts[0] if name_parts else "User"
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    person = Person(
        id=str(uuid4()),
        org_id=org.id,
        first_name=first_name,
        last_name=last_name,
        email=user.email,
        can_login=True,
        user_id=user.id,
    )
    db.add(person)

    session = create_session(db, user.id)

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=org.id,
        ),
        encrypted_private_key=user.encrypted_private_key,
        public_key=user.public_key,
        kdf_iterations=user.kdf_iterations,
        encrypted_org_key=data.encrypted_org_key,
    )


# ── Login ─────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: DBSession = Depends(get_db)):
    user = get_user_by_email(db, data.email.lower().strip())

    # Zero-knowledge mode: verify master_password_hash, else verify raw password
    is_zk = data.master_password_hash is not None
    auth_value = data.master_password_hash if is_zk else data.password

    if not user or not verify_password(auth_value, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    session = create_session(db, user.id)
    orgs = get_user_orgs(db, user.id)
    active_org_id = orgs[0].id if orgs else None

    # Fetch the user's wrapped org key for their active org
    encrypted_org_key = None
    if active_org_id:
        member_key = (
            db.query(OrgMemberKey)
            .filter(
                OrgMemberKey.org_id == active_org_id,
                OrgMemberKey.user_id == user.id,
            )
            .first()
        )
        if member_key:
            encrypted_org_key = member_key.encrypted_org_key

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=active_org_id,
        ),
        encrypted_private_key=user.encrypted_private_key,
        public_key=user.public_key,
        kdf_iterations=user.kdf_iterations,
        encrypted_org_key=encrypted_org_key,
    )


@router.post("/logout", status_code=204)
def logout(
    db: DBSession = Depends(get_db),
    authorization: str | None = Header(None),
):
    if authorization and authorization.startswith("Bearer "):
        delete_session(db, authorization[7:])


@router.get("/me", response_model=UserResponse)
def me(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    orgs = get_user_orgs(db, user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        created_at=user.created_at.isoformat(),
        active_org_id=orgs[0].id if orgs else None,
    )


# ── Org key exchange ──────────────────────────────────────────────


@router.post("/org/{org_id}/keys", status_code=201)
def store_org_key(
    org_id: str,
    data: OrgKeyExchange,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Store a wrapped org key for a target user (key ceremony).

    Called by an existing org member who wraps the org key with the
    target user's public key.
    """
    # Verify caller belongs to this org
    caller_org_id = get_active_org_id(user, db)
    if caller_org_id != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this org")

    # Verify target user exists
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Upsert the org member key
    existing = (
        db.query(OrgMemberKey)
        .filter(
            OrgMemberKey.org_id == org_id,
            OrgMemberKey.user_id == data.user_id,
        )
        .first()
    )
    if existing:
        existing.encrypted_org_key = data.encrypted_org_key
    else:
        member_key = OrgMemberKey(
            org_id=org_id,
            user_id=data.user_id,
            encrypted_org_key=data.encrypted_org_key,
        )
        db.add(member_key)

    db.commit()
    return {"message": "Org key stored successfully"}


@router.get("/org/{org_id}/my-key")
def get_my_org_key(
    org_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get the current user's wrapped org key for a specific org."""
    member_key = (
        db.query(OrgMemberKey)
        .filter(
            OrgMemberKey.org_id == org_id,
            OrgMemberKey.user_id == user.id,
        )
        .first()
    )
    if not member_key:
        raise HTTPException(status_code=404, detail="No org key found")

    return {"encrypted_org_key": member_key.encrypted_org_key}


@router.get("/user/{user_id}/public-key")
def get_user_public_key(
    user_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get a user's public key (for wrapping org keys during key ceremony)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target or not target.public_key:
        raise HTTPException(status_code=404, detail="Public key not found")

    return {"public_key": target.public_key}


@router.get("/org/{org_id}/pending-keys", response_model=list[PendingKeyMember])
def get_pending_key_members(
    org_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List org members who have a public key but no wrapped org key yet.

    These members need the key ceremony: an existing member must wrap
    the org key with each pending member's RSA public key.
    """
    from sqlalchemy import and_

    caller_org_id = get_active_org_id(user, db)
    if caller_org_id != org_id:
        raise HTTPException(status_code=403, detail="Not a member of this org")

    members_with_keys = (
        db.query(OrgMemberKey.user_id)
        .filter(OrgMemberKey.org_id == org_id)
        .subquery()
    )

    pending = (
        db.query(User)
        .join(OrgMembership, and_(
            OrgMembership.user_id == User.id,
            OrgMembership.org_id == org_id,
        ))
        .filter(
            User.public_key.isnot(None),
            User.id.notin_(members_with_keys),
        )
        .all()
    )

    return [
        PendingKeyMember(
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            public_key=u.public_key,
        )
        for u in pending
    ]


# ── Invitation acceptance (public — no auth) ────────────────────


@router.get("/validate-invite", response_model=InviteValidation)
def validate_invite(
    token: str = Query(...),
    db: DBSession = Depends(get_db),
):
    """Validate an invitation token and return context for the accept page."""
    invite = validate_invite_token(db, token)
    if not invite:
        return InviteValidation(valid=False)

    person = db.query(Person).filter(Person.id == invite.person_id).first()
    org = db.query(Organization).filter(Organization.id == invite.org_id).first()

    return InviteValidation(
        valid=True,
        email=invite.email,
        full_name=person.full_name if person else None,
        org_name=org.name if org else None,
    )


@router.post("/accept-invite", response_model=TokenResponse)
def accept_invite_endpoint(
    data: AcceptInviteRequest,
    db: DBSession = Depends(get_db),
):
    """Accept an invitation by setting a password. Creates user and logs them in."""
    if len(data.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )

    # Zero-knowledge mode: use master_password_hash for auth
    is_zk = data.master_password_hash is not None
    password_for_auth = data.master_password_hash if is_zk else data.password

    try:
        user, session, org = accept_invitation(db, data.token, password_for_auth)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Store zero-knowledge keys if provided
    if is_zk:
        user.encrypted_private_key = data.encrypted_private_key
        user.public_key = data.public_key
        user.recovery_encrypted_private_key = data.recovery_encrypted_private_key
        if data.kdf_iterations:
            user.kdf_iterations = data.kdf_iterations
        db.commit()

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=org.id,
        ),
        encrypted_private_key=user.encrypted_private_key,
        public_key=user.public_key,
        kdf_iterations=user.kdf_iterations,
    )


# ── Password reset (public — no auth) ───────────────────────────


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: DBSession = Depends(get_db),
):
    """Request a password reset email. Always returns 200 to prevent email enumeration."""
    token_obj = create_password_reset(db, data.email)
    if token_obj:
        send_password_reset_email(token_obj.email, token_obj.token)
    return {"message": "If an account exists with this email, a reset link has been sent."}


@router.get("/validate-reset", response_model=ResetValidation)
def validate_reset(
    token: str = Query(...),
    db: DBSession = Depends(get_db),
):
    """Validate a password reset token."""
    token_obj = validate_reset_token(db, token)
    return ResetValidation(valid=token_obj is not None)


@router.post("/reset-password")
def reset_password_endpoint(
    data: ResetPasswordRequest,
    db: DBSession = Depends(get_db),
):
    """Reset password using a valid token.

    In zero-knowledge mode, client sends new master_password_hash and
    re-encrypted private key.
    """
    if len(data.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )

    is_zk = data.master_password_hash is not None
    password_for_auth = data.master_password_hash if is_zk else data.password

    try:
        reset_password(db, data.token, password_for_auth)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Update zero-knowledge keys if provided
    if is_zk and data.encrypted_private_key:
        token_obj = validate_reset_token(db, data.token)
        if token_obj:
            user = get_user_by_email(db, token_obj.email)
            if user:
                user.encrypted_private_key = data.encrypted_private_key
                if data.recovery_encrypted_private_key:
                    user.recovery_encrypted_private_key = data.recovery_encrypted_private_key
                if data.kdf_iterations:
                    user.kdf_iterations = data.kdf_iterations
                db.commit()

    return {"message": "Password reset successfully"}


# ── Password change (authenticated) ─────────────────────────────


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Change password for the currently logged-in user.

    In zero-knowledge mode, client sends old and new master_password_hash
    along with re-encrypted private key.
    """
    is_zk = data.current_master_password_hash is not None

    if is_zk:
        # Verify current master password hash
        if not verify_password(data.current_master_password_hash, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if not data.new_master_password_hash:
            raise HTTPException(status_code=400, detail="New master password hash required")

        user.password_hash = hash_password(data.new_master_password_hash)

        if data.new_encrypted_private_key:
            user.encrypted_private_key = data.new_encrypted_private_key
        if data.new_recovery_encrypted_private_key:
            user.recovery_encrypted_private_key = data.new_recovery_encrypted_private_key
        if data.new_kdf_iterations:
            user.kdf_iterations = data.new_kdf_iterations
    else:
        # Legacy mode
        if len(data.new_password) < 8:
            raise HTTPException(
                status_code=400, detail="New password must be at least 8 characters"
            )
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        user.password_hash = hash_password(data.new_password)

    db.commit()

    return {"message": "Password changed successfully"}
