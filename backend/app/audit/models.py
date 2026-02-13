"""
audit/models.py — SQLAlchemy model for security audit log.

Tracks security-relevant events: key ceremonies, password changes,
login/logout, session invalidation, etc.

TABLE: audit_log
  - id (PK, uuid)
  - user_id (FK → users.id, nullable for pre-auth events)
  - org_id (FK → organizations.id, nullable)
  - action (str 50) — event type, e.g. "login", "key_ceremony", "password_change"
  - detail (text) — human-readable description
  - ip_address (str 45) — client IP (supports IPv6)
  - created_at (timestamptz)

MIGRATION HISTORY:
  021 — created audit_log table
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    org_id: Mapped[str | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
