"""
invitations/models.py — SQLAlchemy model for invitation and password-reset tokens.

Single table serves both purposes, distinguished by the 'purpose' column.

TABLE: invitation_tokens
  - id (PK, uuid)
  - email (str 255, NOT NULL)
  - token (str 64, UNIQUE, INDEXED)
  - purpose (str 20, NOT NULL) — "invite" or "password_reset"
  - person_id (FK → people.id) — nullable, for invitations
  - org_id (FK → organizations.id) — nullable, for invitations
  - user_id (FK → users.id) — nullable, for password resets
  - expires_at (datetime, NOT NULL)
  - created_at (datetime)
  - used_at (datetime) — set when consumed

MIGRATION HISTORY:
  018 — created invitation_tokens table
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InvitationToken(Base):
    __tablename__ = "invitation_tokens"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    person_id: Mapped[str | None] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), nullable=True, index=True
    )
    org_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
