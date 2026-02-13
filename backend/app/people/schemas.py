"""
people/schemas.py — Pydantic schemas for people CRUD operations.

Schemas:
  PersonCreate   — POST /api/people body
  PersonUpdate   — PATCH /api/people/{id} body (all fields optional)
  PersonOut      — response model for all people endpoints
"""
from datetime import date, datetime

from pydantic import BaseModel, computed_field


class PersonCreate(BaseModel):
    first_name: str
    last_name: str
    photo_url: str | None = None
    date_of_birth: date | None = None
    email: str | None = None
    phone: str | None = None
    relationship: str | None = None
    notes: str | None = None
    can_login: bool = False
    encryption_version: int = 1


class PersonUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    photo_url: str | None = None
    date_of_birth: date | None = None
    email: str | None = None
    phone: str | None = None
    relationship: str | None = None
    notes: str | None = None
    can_login: bool | None = None
    encryption_version: int | None = None


class PersonOut(BaseModel):
    id: str
    org_id: str
    first_name: str
    last_name: str
    photo_url: str | None = None
    date_of_birth: date | None = None
    email: str | None = None
    phone: str | None = None
    relationship: str | None = None
    notes: str | None = None
    can_login: bool = False
    user_id: str | None = None
    encryption_version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def full_name(self) -> str:
        """Return the full name of the person."""
        return f"{self.first_name} {self.last_name}"

    @computed_field
    @property
    def status(self) -> str:
        """Derive login status from can_login + user_id."""
        if self.can_login and self.user_id:
            return "active"
        if self.can_login and not self.user_id:
            return "invited"
        if not self.can_login and self.user_id:
            return "inactive"
        return "none"


class LinkPersonRequest(BaseModel):
    person_id: str
    role: str | None = None


class LinkedPersonOut(BaseModel):
    id: str
    person_id: str
    item_id: str
    role: str | None = None
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    relationship: str | None = None
    encryption_version: int = 1
    created_at: datetime

    model_config = {"from_attributes": True}
