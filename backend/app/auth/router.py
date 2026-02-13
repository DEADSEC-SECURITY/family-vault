from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession
from uuid import uuid4

from app.auth.models import User
from app.auth.schemas import (
    AcceptInviteRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    InviteValidation,
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
from app.orgs.models import Organization
from app.orgs.service import create_organization, get_user_orgs
from app.people.models import Person

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserCreate, db: DBSession = Depends(get_db)):
    existing = get_user_by_email(db, data.email.lower().strip())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
    )
    db.add(user)
    db.flush()

    # Auto-create personal organization
    org = create_organization(
        db, name=f"{user.full_name}'s Vault", created_by=user.id
    )

    # Auto-create person record for the user
    # Split full_name into first and last name (or use defaults)
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
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: DBSession = Depends(get_db)):
    user = get_user_by_email(db, data.email.lower().strip())
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    session = create_session(db, user.id)
    orgs = get_user_orgs(db, user.id)

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=orgs[0].id if orgs else None,
        ),
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

    try:
        user, session, org = accept_invitation(db, data.token, data.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return TokenResponse(
        token=session.token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at.isoformat(),
            active_org_id=org.id,
        ),
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
    """Reset password using a valid token."""
    if len(data.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )

    try:
        reset_password(db, data.token, data.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "Password reset successfully"}


# ── Password change (authenticated) ─────────────────────────────


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Change password for the currently logged-in user."""
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400, detail="New password must be at least 8 characters"
        )

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(data.new_password)
    db.commit()

    return {"message": "Password changed successfully"}
