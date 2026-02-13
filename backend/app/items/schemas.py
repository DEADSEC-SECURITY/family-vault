from datetime import datetime

from pydantic import BaseModel


class FieldValueIn(BaseModel):
    field_key: str
    field_value: str | None = None


class ItemCreate(BaseModel):
    category: str
    subcategory: str
    name: str
    notes: str | None = None
    fields: list[FieldValueIn] = []
    encryption_version: int = 1  # 1 = server-side, 2 = client-side


class ItemUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    fields: list[FieldValueIn] | None = None
    encryption_version: int | None = None  # set to 2 for client-side encryption


class FieldValueOut(BaseModel):
    field_key: str
    field_value: str | None
    field_type: str


class FileOut(BaseModel):
    id: str
    file_name: str
    file_size: int
    mime_type: str
    purpose: str | None
    encryption_version: int = 1
    created_at: datetime


class ItemResponse(BaseModel):
    id: str
    org_id: str
    category: str
    subcategory: str
    name: str
    notes: str | None
    is_archived: bool
    encryption_version: int = 1
    fields: list[FieldValueOut]
    files: list[FileOut]
    created_at: datetime
    updated_at: datetime


class ItemListResponse(BaseModel):
    items: list[ItemResponse]
    total: int
    page: int
    limit: int
