from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: str
    password: str


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


class AcceptInviteRequest(BaseModel):
    token: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class InviteValidation(BaseModel):
    valid: bool
    email: str | None = None
    full_name: str | None = None
    org_name: str | None = None


class ResetValidation(BaseModel):
    valid: bool
