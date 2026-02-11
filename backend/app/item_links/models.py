"""
item_links/models.py — SQLAlchemy model for item-to-item linking.

TABLE: item_links
  - id (PK, uuid)
  - parent_item_id (FK → items.id)  — e.g. the business entity
  - child_item_id  (FK → items.id)  — e.g. the business license
  - link_type (str 50)              — e.g. "business_license"
  - org_id (FK → organizations.id)
  - created_at
  - UNIQUE(child_item_id, link_type) — one child links to at most one parent per type

MIGRATION: 015
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemLink(Base):
    __tablename__ = "item_links"
    __table_args__ = (
        UniqueConstraint("child_item_id", "link_type", name="uq_child_item_link_type"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    parent_item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    child_item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    link_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    parent_item = relationship("Item", foreign_keys=[parent_item_id])
    child_item = relationship("Item", foreign_keys=[child_item_id])
