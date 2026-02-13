"""
saved_contacts/schemas.py — Pydantic schemas for saved contacts CRUD + linking.

Schemas:
  SavedContactCreate       — POST /api/saved-contacts body
  SavedContactUpdate       — PATCH /api/saved-contacts/{id} body
  SavedContactOut          — response model for CRUD endpoints
  LinkSavedContactRequest  — POST /api/saved-contacts/item/{item_id} body
  LinkedSavedContactOut    — response for per-item listing
"""
from datetime import datetime

from pydantic import BaseModel


class SavedContactCreate(BaseModel):
    name: str
    company: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    encryption_version: int = 1


class SavedContactUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    encryption_version: int | None = None


class SavedContactOut(BaseModel):
    id: str
    org_id: str
    name: str
    company: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    encryption_version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LinkSavedContactRequest(BaseModel):
    saved_contact_id: str


class LinkedSavedContactOut(BaseModel):
    id: str
    saved_contact_id: str
    item_id: str
    name: str
    company: str | None = None
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    encryption_version: int = 1
    created_at: datetime
