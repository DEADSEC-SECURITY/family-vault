"""
people/models.py — SQLAlchemy models for org-wide people database.

People are org-scoped records (name, photo, contact info) that can be referenced
throughout the app (beneficiaries, insured persons, etc.). People can optionally
have login access via a linked user account.

TABLE: people
  - id (PK, uuid)
  - org_id (FK → organizations.id)
  - first_name (str 100, NOT NULL)
  - last_name (str 100, NOT NULL)
  - photo_url (str 500)         — nullable, S3/MinIO path
  - date_of_birth (date)        — nullable
  - email (str 255)             — nullable
  - phone (str 50)              — nullable
  - relationship (str 100)      — nullable, e.g. "Spouse", "Child", "Grandparent"
  - notes (text)                — nullable
  - can_login (bool)            — default False
  - user_id (FK → users.id)     — nullable, links to user if can_login=True
  - created_at, updated_at

MIGRATION HISTORY:
  010 — created people table
"""
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship as rel

from app.database import Base


class Person(Base):
    __tablename__ = "people"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    relationship: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    can_login: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = rel("User")

    @property
    def full_name(self) -> str:
        """Return the full name of the person."""
        return f"{self.first_name} {self.last_name}"


class ItemPerson(Base):
    """Junction table linking people to items with a role (Owner, Beneficiary, etc.)."""

    __tablename__ = "item_people"
    __table_args__ = (
        UniqueConstraint("item_id", "person_id", "role", name="uq_item_person_role"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    person_id: Mapped[str] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    person = rel("Person")
