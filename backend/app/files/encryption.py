import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_file(data: bytes, org_key: bytes) -> tuple[bytes, bytes, bytes]:
    """Encrypt file data with AES-256-GCM.

    Returns: (ciphertext_without_tag, iv, tag)
    """
    iv = os.urandom(12)
    aesgcm = AESGCM(org_key)
    ciphertext_with_tag = aesgcm.encrypt(iv, data, None)
    # AES-GCM appends the 16-byte auth tag to the ciphertext
    ciphertext = ciphertext_with_tag[:-16]
    tag = ciphertext_with_tag[-16:]
    return ciphertext, iv, tag


def decrypt_file(ciphertext: bytes, iv: bytes, tag: bytes, org_key: bytes) -> bytes:
    """Decrypt file data with AES-256-GCM."""
    aesgcm = AESGCM(org_key)
    return aesgcm.decrypt(iv, ciphertext + tag, None)


def encrypt_field(value: str, org_key: bytes) -> str:
    """Encrypt a field value with AES-256-GCM.

    Returns a base64-encoded string in format: base64(iv + tag + ciphertext)
    This allows storing the encrypted value as a single string in the database.

    Args:
        value: The plain text value to encrypt
        org_key: The organization's encryption key (32 bytes)

    Returns:
        Base64-encoded encrypted value with IV and tag prepended
    """
    if not value:
        return value

    # Generate random IV (12 bytes for GCM)
    iv = os.urandom(12)

    # Encrypt the value
    aesgcm = AESGCM(org_key)
    value_bytes = value.encode('utf-8')
    ciphertext_with_tag = aesgcm.encrypt(iv, value_bytes, None)

    # Extract ciphertext and tag
    ciphertext = ciphertext_with_tag[:-16]
    tag = ciphertext_with_tag[-16:]

    # Combine: iv (12) + tag (16) + ciphertext (variable)
    combined = iv + tag + ciphertext

    # Base64 encode for storage as text
    return base64.b64encode(combined).decode('ascii')


def decrypt_field(encrypted_value: str, org_key: bytes) -> str:
    """Decrypt a field value encrypted with encrypt_field.

    Args:
        encrypted_value: Base64-encoded encrypted value
        org_key: The organization's encryption key (32 bytes)

    Returns:
        Decrypted plain text value
    """
    if not encrypted_value:
        return encrypted_value

    try:
        # Decode from base64
        combined = base64.b64decode(encrypted_value)

        # Extract components
        iv = combined[:12]
        tag = combined[12:28]
        ciphertext = combined[28:]

        # Decrypt
        aesgcm = AESGCM(org_key)
        plaintext_bytes = aesgcm.decrypt(iv, ciphertext + tag, None)

        return plaintext_bytes.decode('utf-8')
    except Exception:
        # If decryption fails, return the original value
        # This handles cases where data isn't encrypted yet (during migration)
        return encrypted_value
