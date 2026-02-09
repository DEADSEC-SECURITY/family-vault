"""
contacts/schemas.py — Pydantic schemas for contact CRUD operations.

Schemas:
  ItemContactCreate  — POST /api/contacts body
  ItemContactOut     — response model for all contact endpoints
  ItemContactUpdate  — PATCH /api/contacts/{id} body (all fields optional)
  ContactReorderItem — single item in reorder request
  ContactReorderRequest — PUT /api/contacts/reorder body

ADDRESS FIELDS: For contact_type="address", the frontend sends structured fields
(address_line1..address_zip). The backend auto-composes the `value` field from these
for backward compatibility and display fallback.
"""
from pydantic import BaseModel


class ItemContactCreate(BaseModel):
    item_id: str
    label: str
    value: str = ""  # auto-composed for address type if not provided
    contact_type: str = "phone"  # phone, email, url, address
    sort_order: int = 0

    # Structured address fields (only for contact_type == "address")
    address_line1: str | None = None
    address_line2: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None


class ItemContactOut(BaseModel):
    id: str
    item_id: str
    label: str
    value: str
    contact_type: str
    sort_order: int = 0

    # Structured address fields
    address_line1: str | None = None
    address_line2: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None

    model_config = {"from_attributes": True}


class ItemContactUpdate(BaseModel):
    label: str | None = None
    value: str | None = None
    contact_type: str | None = None

    # Structured address fields
    address_line1: str | None = None
    address_line2: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None


class ContactReorderItem(BaseModel):
    id: str
    sort_order: int


class ContactReorderRequest(BaseModel):
    item_id: str
    contacts: list[ContactReorderItem]
