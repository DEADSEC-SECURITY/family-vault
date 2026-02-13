"""
invitations/service.py — Business logic for invitation and password-reset flows.

Handles token creation, validation, consumption, and email sending for both
family member invitations and password reset requests.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.auth.service import create_session, get_user_by_email, hash_password
from app.config import settings
from app.email.service import send_email_async
from app.invitations.models import InvitationToken
from app.orgs.models import OrgMembership, Organization
from app.people.models import Person

logger = logging.getLogger(__name__)

INVITE_EXPIRY_HOURS = 72
RESET_EXPIRY_HOURS = 1


# ── Invitation flow ─────────────────────────────────────────────


def create_invitation(db: DBSession, person: Person, org_id: str) -> InvitationToken:
    """Generate an invitation token for a person. Invalidates any prior unused tokens."""
    _invalidate_tokens(db, purpose="invite", person_id=person.id)

    token = InvitationToken(
        email=person.email,
        token=secrets.token_urlsafe(48),
        purpose="invite",
        person_id=person.id,
        org_id=org_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=INVITE_EXPIRY_HOURS),
    )
    db.add(token)
    db.flush()
    return token


def send_invitation_email(person: Person, token: str, org_name: str) -> None:
    """Send an invitation email with a link to set up a password."""
    invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
    subject = f"You're invited to {org_name} on FamilyVault"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">FamilyVault Invitation</h2>
        <p>Hi {person.first_name},</p>
        <p>You've been invited to join <strong>{org_name}</strong> on FamilyVault,
           a secure family document vault.</p>
        <p>Click the button below to set up your password and get started:</p>
        <div style="margin: 24px 0;">
            <a href="{invite_url}"
               style="display: inline-block; padding: 12px 24px;
                      background-color: #4f46e5; color: #ffffff;
                      text-decoration: none; border-radius: 6px;
                      font-weight: 600;">
                Accept Invitation
            </a>
        </div>
        <p style="color: #64748b; font-size: 14px;">
            This link expires in {INVITE_EXPIRY_HOURS} hours. If the button doesn't work,
            copy and paste this URL into your browser:
        </p>
        <p style="color: #64748b; font-size: 14px; word-break: break-all;">
            {invite_url}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">
            If you didn't expect this invitation, you can safely ignore this email.
        </p>
    </div>
    """
    send_email_async(person.email, subject, html_body)


def validate_invite_token(db: DBSession, token_str: str) -> InvitationToken | None:
    """Return a valid, unused, non-expired invitation token or None."""
    return (
        db.query(InvitationToken)
        .filter(
            InvitationToken.token == token_str,
            InvitationToken.purpose == "invite",
            InvitationToken.used_at.is_(None),
            InvitationToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )


def accept_invitation(db: DBSession, token_str: str, password: str):
    """Accept an invitation: create User, OrgMembership, link Person.

    Returns (user, session) on success.
    Raises ValueError with a message on failure.
    """
    invite = validate_invite_token(db, token_str)
    if not invite:
        raise ValueError("Invalid or expired invitation link")

    # Check if email is already registered
    existing = get_user_by_email(db, invite.email.lower().strip())
    if existing:
        raise ValueError("An account with this email already exists. Please log in instead.")

    # Load the person and org
    person = db.query(Person).filter(Person.id == invite.person_id).first()
    if not person:
        raise ValueError("Invitation is no longer valid")

    org = db.query(Organization).filter(Organization.id == invite.org_id).first()
    if not org:
        raise ValueError("Organization no longer exists")

    # Create user account
    user = User(
        email=invite.email.lower().strip(),
        password_hash=hash_password(password),
        full_name=person.full_name,
    )
    db.add(user)
    db.flush()

    # Link person to user
    person.user_id = user.id

    # Create org membership
    membership = OrgMembership(
        org_id=invite.org_id,
        user_id=user.id,
        role="member",
    )
    db.add(membership)

    # Mark token as used
    invite.used_at = datetime.now(timezone.utc)

    session = create_session(db, user.id)
    return user, session, org


# ── Password reset flow ─────────────────────────────────────────


def create_password_reset(db: DBSession, email: str) -> InvitationToken | None:
    """Generate a password reset token. Returns None if user not found (silent)."""
    user = get_user_by_email(db, email.lower().strip())
    if not user:
        return None

    _invalidate_tokens(db, purpose="password_reset", user_id=user.id)

    token = InvitationToken(
        email=user.email,
        token=secrets.token_urlsafe(48),
        purpose="password_reset",
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=RESET_EXPIRY_HOURS),
    )
    db.add(token)
    db.commit()
    return token


def send_password_reset_email(email: str, token: str) -> None:
    """Send a password reset email."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "FamilyVault Password Reset"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Password Reset</h2>
        <p>We received a request to reset your FamilyVault password.</p>
        <p>Click the button below to set a new password:</p>
        <div style="margin: 24px 0;">
            <a href="{reset_url}"
               style="display: inline-block; padding: 12px 24px;
                      background-color: #4f46e5; color: #ffffff;
                      text-decoration: none; border-radius: 6px;
                      font-weight: 600;">
                Reset Password
            </a>
        </div>
        <p style="color: #64748b; font-size: 14px;">
            This link expires in {RESET_EXPIRY_HOURS} hour. If the button doesn't work,
            copy and paste this URL into your browser:
        </p>
        <p style="color: #64748b; font-size: 14px; word-break: break-all;">
            {reset_url}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">
            If you didn't request a password reset, you can safely ignore this email.
        </p>
    </div>
    """
    send_email_async(email, subject, html_body)


def validate_reset_token(db: DBSession, token_str: str) -> InvitationToken | None:
    """Return a valid, unused, non-expired password-reset token or None."""
    return (
        db.query(InvitationToken)
        .filter(
            InvitationToken.token == token_str,
            InvitationToken.purpose == "password_reset",
            InvitationToken.used_at.is_(None),
            InvitationToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )


def reset_password(db: DBSession, token_str: str, new_password: str) -> User:
    """Reset a user's password using a valid token.

    Raises ValueError on failure.
    """
    token_obj = validate_reset_token(db, token_str)
    if not token_obj:
        raise ValueError("Invalid or expired reset link")

    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise ValueError("User not found")

    user.password_hash = hash_password(new_password)
    token_obj.used_at = datetime.now(timezone.utc)
    db.commit()
    return user


# ── Helpers ──────────────────────────────────────────────────────


def _invalidate_tokens(
    db: DBSession,
    purpose: str,
    person_id: str | None = None,
    user_id: str | None = None,
) -> None:
    """Mark all unused tokens for a given person/user and purpose as used."""
    now = datetime.now(timezone.utc)
    query = db.query(InvitationToken).filter(
        InvitationToken.purpose == purpose,
        InvitationToken.used_at.is_(None),
    )
    if person_id:
        query = query.filter(InvitationToken.person_id == person_id)
    if user_id:
        query = query.filter(InvitationToken.user_id == user_id)
    query.update({"used_at": now})
