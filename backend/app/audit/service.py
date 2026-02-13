"""
audit/service.py — Lightweight audit logger for security events.

Usage:
    from app.audit.service import log_audit
    log_audit(db, action="login", user_id=user.id, ip=request.client.host)
"""
import logging

from sqlalchemy.orm import Session as DBSession

from app.audit.models import AuditLog

logger = logging.getLogger(__name__)


def log_audit(
    db: DBSession,
    *,
    action: str,
    user_id: str | None = None,
    org_id: str | None = None,
    detail: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Write one row to the audit log. Never raises — swallows errors."""
    try:
        entry = AuditLog(
            user_id=user_id,
            org_id=org_id,
            action=action,
            detail=detail,
            ip_address=ip_address,
        )
        db.add(entry)
        db.flush()  # flush but don't commit — caller controls the transaction
    except Exception:
        logger.warning("Failed to write audit log entry: %s", action, exc_info=True)
