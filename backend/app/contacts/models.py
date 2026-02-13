"""
contacts/models.py — SQLAlchemy model for linked contacts on items.

Each item can have multiple contacts (phone numbers, emails, URLs, addresses).
Contacts are displayed in the RightSidebar on the item page, ordered by sort_order.

TABLE: item_contacts
  - id (PK, uuid)
  - item_id (FK → items.id)
  - org_id (FK → organizations.id)
  - label (str 100)    — display name, e.g. "Customer Care", "Claims Address"
  - value (str 255)    — phone/email/url, or auto-composed address string
  - contact_type (str) — one of: phone, email, url, address
  - sort_order (int)   — drag-to-reorder position
  - address_line1..address_zip — structured address fields (nullable, only for type=address)
  - created_at

MIGRATION HISTORY:
  004 — created table (id, item_id, org_id, label, value, contact_type, created_at)
  006 — added sort_order column
  007 — added address_line1, address_line2, address_city, address_state, address_zip
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemContact(Base):
    __tablename__ = "item_contacts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "Customer Care", "TTY", "Prior Authorization"
    value: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # phone number, URL, etc. (for address type, auto-composed from parts)
    contact_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="phone"
    )  # phone, email, url, address
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    # Structured address fields (only used when contact_type == "address")
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    encryption_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    item = relationship("Item")
