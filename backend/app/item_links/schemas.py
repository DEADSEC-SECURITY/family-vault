from datetime import datetime

from pydantic import BaseModel


class LinkItemRequest(BaseModel):
    parent_item_id: str
    link_type: str = "business_license"


class LinkedParentOut(BaseModel):
    id: str  # item_link row ID
    item_id: str  # the parent item's ID
    name: str
    subcategory: str
    is_archived: bool


class LinkedChildOut(BaseModel):
    id: str  # item_link row ID
    item_id: str  # the child item's ID
    name: str
    subcategory: str
    is_archived: bool
    license_type: str | None = None
    expiration_date: str | None = None
    issuing_authority: str | None = None
    provider: str | None = None
    coverage_type: str | None = None
    premium: str | None = None
    document_type: str | None = None
    tax_year: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
