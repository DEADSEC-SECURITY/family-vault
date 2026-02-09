"""Email service using smtplib for sending reminder notifications."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from threading import Thread

from app.config import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    """Check if SMTP is configured."""
    return bool(settings.SMTP_HOST)


def _send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email synchronously. Intended to be called from a thread."""
    if not _is_configured():
        logger.debug("SMTP not configured, skipping email to %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)

        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(settings.SMTP_FROM, [to], msg.as_string())
        server.quit()
        logger.info("Email sent to %s: %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s", to)


def send_email_async(to: str, subject: str, html_body: str) -> None:
    """Send an email in a background thread to avoid blocking."""
    if not _is_configured():
        return
    thread = Thread(target=_send_email, args=(to, subject, html_body), daemon=True)
    thread.start()


def send_reminder_email(
    to: str,
    item_name: str,
    reminder_title: str,
    remind_date: str,
    category: str,
    item_id: str,
) -> None:
    """Send a reminder notification email."""
    subject = f"FamilyVault Reminder: {reminder_title}"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">FamilyVault Reminder</h2>
        <p>This is a reminder for your item:</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 16px;">{item_name}</p>
            <p style="margin: 0 0 4px 0; color: #64748b;">
                <strong>Reminder:</strong> {reminder_title}
            </p>
            <p style="margin: 0; color: #64748b;">
                <strong>Date:</strong> {remind_date}
            </p>
        </div>
        <p style="color: #64748b; font-size: 14px;">
            Category: {category.replace("_", " ").title()}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">
            This is an automated reminder from FamilyVault.
        </p>
    </div>
    """
    send_email_async(to, subject, html_body)
