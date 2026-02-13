from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    # Zero-knowledge fields (optional for backward compat during migration)
    master_password_hash: str | None = None
    encrypted_private_key: str | None = None
    public_key: str | None = None
    encrypted_org_key: str | None = None  # org key wrapped with user's public key
    recovery_encrypted_private_key: str | None = None
    kdf_iterations: int | None = None


class UserLogin(BaseModel):
    email: str
    password: str
    # Zero-knowledge: client sends master_password_hash instead of password
    master_password_hash: str | None = None


class PreloginRequest(BaseModel):
    email: str


class PreloginResponse(BaseModel):
    kdf_iterations: int
    email: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: datetime
    active_org_id: str | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
    # Zero-knowledge: returned on login so client can decrypt keys
    encrypted_private_key: str | None = None
    public_key: str | None = None
    kdf_iterations: int | None = None
    encrypted_org_key: str | None = None  # wrapped org key for active org


class AcceptInviteRequest(BaseModel):
    token: str
    password: str
    # Zero-knowledge fields for invitation acceptance
    master_password_hash: str | None = None
    encrypted_private_key: str | None = None
    public_key: str | None = None
    recovery_encrypted_private_key: str | None = None
    kdf_iterations: int | None = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    # Zero-knowledge: client re-derives keys with new password
    master_password_hash: str | None = None
    encrypted_private_key: str | None = None
    recovery_encrypted_private_key: str | None = None
    kdf_iterations: int | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    # Zero-knowledge: client re-encrypts private key with new symmetric key
    current_master_password_hash: str | None = None
    new_master_password_hash: str | None = None
    new_encrypted_private_key: str | None = None
    new_recovery_encrypted_private_key: str | None = None
    new_kdf_iterations: int | None = None


class InviteValidation(BaseModel):
    valid: bool
    email: str | None = None
    full_name: str | None = None
    org_name: str | None = None


class ResetValidation(BaseModel):
    valid: bool


class OrgKeyExchange(BaseModel):
    """Payload for sharing an org key with a user."""
    user_id: str
    encrypted_org_key: str  # org key wrapped with target user's public key
