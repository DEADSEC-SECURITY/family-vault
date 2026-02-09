"""Encrypt sensitive field data

Revision ID: 012
Revises: 011
Create Date: 2026-02-08

"""
from typing import Sequence, Union
import base64
import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_master_key(secret_key: str) -> bytes:
    """Derive master key from SECRET_KEY."""
    hkdf = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"familyvault-master-key-salt",
        info=b"master-encryption-key",
    )
    return hkdf.derive(secret_key.encode("utf-8"))


def _decrypt_org_key(encrypted: str, master_key: bytes) -> bytes:
    """Decrypt an org key."""
    raw = base64.b64decode(encrypted)
    iv = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(master_key)
    return aesgcm.decrypt(iv, ciphertext, None)


def encrypt_field(value: str, org_key: bytes) -> str:
    """Encrypt a field value with AES-256-GCM."""
    if not value:
        return value

    iv = os.urandom(12)
    aesgcm = AESGCM(org_key)
    value_bytes = value.encode('utf-8')
    ciphertext_with_tag = aesgcm.encrypt(iv, value_bytes, None)

    ciphertext = ciphertext_with_tag[:-16]
    tag = ciphertext_with_tag[-16:]
    combined = iv + tag + ciphertext

    return base64.b64encode(combined).decode('ascii')


# Field definitions - mapping category/subcategory to encrypted field keys
ENCRYPTED_FIELDS = {
    "ids": {
        "drivers_license": {"license_number"},
        "passport": {"passport_number"},
        "social_security_card": {"ssn"},
        "birth_certificate": {"certificate_number"},
        "custom_id": {"id_number"},
        "visa": {"visa_number"},
    },
    "insurance": {
        "auto_insurance": {"policy_number"},
        "health_insurance": {"policy_number", "group_number", "member_id"},
        "home_insurance": {"policy_number"},
        "life_insurance": {"policy_number"},
        "other_insurance": {"policy_number"},
    },
    "business": {
        "llc": {"ein"},
        "corporation": {"ein"},
        "partnership": {"ein"},
        "sole_proprietorship": {"ein"},
        "business_license": {"license_number"},
        "business_insurance": {"policy_number"},
        "tax_document": set(),  # No encrypted fields
    },
}


def upgrade() -> None:
    """Encrypt all existing sensitive field data."""
    # Get database connection
    bind = op.get_bind()

    # Get SECRET_KEY from environment
    import os
    secret_key = os.getenv("SECRET_KEY", "change-me-in-production")
    master_key = _get_master_key(secret_key)

    # Cache for org keys
    org_keys = {}

    # Get all items with their fields
    items_query = text("""
        SELECT i.id, i.org_id, i.category, i.subcategory
        FROM items i
    """)
    items = bind.execute(items_query).fetchall()

    for item in items:
        item_id, org_id, category, subcategory = item

        # Get encrypted field keys for this item type
        category_fields = ENCRYPTED_FIELDS.get(category, {})
        encrypted_keys = category_fields.get(subcategory, set())

        if not encrypted_keys:
            continue  # No encrypted fields for this type

        # Get org encryption key (cached)
        if org_id not in org_keys:
            org_query = text("SELECT encryption_key_enc FROM organizations WHERE id = :org_id")
            org_result = bind.execute(org_query, {"org_id": org_id}).fetchone()
            if org_result:
                encrypted_org_key = org_result[0]
                org_keys[org_id] = _decrypt_org_key(encrypted_org_key, master_key)

        org_key = org_keys.get(org_id)
        if not org_key:
            continue  # Skip if org not found

        # Get field values for this item
        fields_query = text("""
            SELECT id, field_key, field_value
            FROM item_field_values
            WHERE item_id = :item_id
        """)
        fields = bind.execute(fields_query, {"item_id": item_id}).fetchall()

        # Encrypt sensitive fields
        for field in fields:
            field_id, field_key, field_value = field

            if field_key in encrypted_keys and field_value:
                # Check if already encrypted (starts with base64-like pattern and is longer)
                # Skip if value looks already encrypted to avoid double-encryption
                try:
                    # If it decodes as base64 and is 40+ chars, assume encrypted
                    test = base64.b64decode(field_value)
                    if len(field_value) > 40:
                        continue  # Likely already encrypted
                except:
                    pass  # Not base64, proceed with encryption

                # Encrypt the field
                encrypted_value = encrypt_field(field_value, org_key)

                # Update in database
                update_query = text("""
                    UPDATE item_field_values
                    SET field_value = :encrypted_value
                    WHERE id = :field_id
                """)
                bind.execute(update_query, {
                    "encrypted_value": encrypted_value,
                    "field_id": field_id
                })


def downgrade() -> None:
    """Cannot downgrade - encrypted data cannot be safely decrypted in migration."""
    # This is a one-way migration. To downgrade, you would need to:
    # 1. Have access to org encryption keys
    # 2. Decrypt all encrypted fields
    # This is too risky to automate, so we leave it as no-op
    pass
