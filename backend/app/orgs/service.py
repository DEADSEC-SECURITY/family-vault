import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.orgs.models import OrgMembership, Organization


def _get_master_key() -> bytes:
    """Derive a 256-bit master key from SECRET_KEY using HKDF."""
    hkdf = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"familyvault-master-key-salt",
        info=b"master-encryption-key",
    )
    return hkdf.derive(settings.SECRET_KEY.encode("utf-8"))


def _encrypt_org_key(org_key: bytes) -> str:
    """Encrypt an org key with the master key. Returns base64-encoded string."""
    master_key = _get_master_key()
    iv = os.urandom(12)
    aesgcm = AESGCM(master_key)
    ciphertext = aesgcm.encrypt(iv, org_key, None)
    # Store as base64: iv + ciphertext (includes GCM tag)
    return base64.b64encode(iv + ciphertext).decode("utf-8")


def _decrypt_org_key(encrypted: str) -> bytes:
    """Decrypt an org key with the master key."""
    master_key = _get_master_key()
    raw = base64.b64decode(encrypted)
    iv = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(master_key)
    return aesgcm.decrypt(iv, ciphertext, None)


def create_organization(
    db: DBSession, name: str, created_by: str
) -> Organization:
    """Create a new organization with a random encryption key."""
    org_key = os.urandom(32)  # 256-bit random key
    encryption_key_enc = _encrypt_org_key(org_key)

    org = Organization(
        name=name,
        encryption_key_enc=encryption_key_enc,
        created_by=created_by,
    )
    db.add(org)
    db.flush()

    membership = OrgMembership(
        org_id=org.id,
        user_id=created_by,
        role="owner",
    )
    db.add(membership)
    db.commit()
    db.refresh(org)
    return org


def get_org_encryption_key(org: Organization) -> bytes:
    """Get the decrypted encryption key for an organization."""
    return _decrypt_org_key(org.encryption_key_enc)


def get_user_orgs(db: DBSession, user_id: str) -> list[Organization]:
    """Get all organizations a user belongs to."""
    return (
        db.query(Organization)
        .join(OrgMembership)
        .filter(OrgMembership.user_id == user_id)
        .all()
    )


def get_active_org(user, db: DBSession) -> "Organization":
    """Get the first org the user belongs to (full object).

    Shared helper used by routers that need the full org (e.g. encryption key).
    Raises HTTPException 400 if the user has no organization.
    """
    from fastapi import HTTPException

    orgs = get_user_orgs(db, user.id)
    if not orgs:
        raise HTTPException(status_code=400, detail="No organization found")
    return orgs[0]


def get_active_org_id(user, db: DBSession) -> str:
    """Get the first org ID the user belongs to.

    Shared helper used by all routers that need org-scoped queries.
    Raises HTTPException 400 if the user has no organization.
    """
    return get_active_org(user, db).id


def get_user_membership(
    db: DBSession, user_id: str, org_id: str
) -> OrgMembership | None:
    """Get a user's membership in a specific org."""
    return (
        db.query(OrgMembership)
        .filter(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
        .first()
    )


def get_org_by_id(db: DBSession, org_id: str) -> Organization | None:
    return db.query(Organization).filter(Organization.id == org_id).first()
