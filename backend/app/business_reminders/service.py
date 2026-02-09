"""Service for auto-generating business tax and compliance reminders."""

from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session as DBSession

from app.business_reminders.templates import (
    EMPLOYMENT_TAX_REMINDERS,
    FEDERAL_TAX_REMINDERS,
    S_CORP_REMINDERS,
    STATE_COMPLIANCE_REMINDERS,
)
from app.reminders.models import CustomReminder


def _calculate_reminder_date(month: int | None, day: int | None, formation_date: date | None = None) -> date:
    """Calculate the next reminder date based on month/day or formation date.

    Args:
        month: Month number (1-12), or None for anniversary-based
        day: Day of month, or None for anniversary-based
        formation_date: Date of business formation (for anniversary-based reminders)

    Returns:
        Next occurrence date for the reminder
    """
    today = date.today()

    if month is None or day is None:
        # Anniversary-based reminder (e.g., Statement of Information)
        if formation_date:
            # Use formation month/day
            remind_date = date(today.year, formation_date.month, formation_date.day)
            # If already passed this year, schedule for next year
            if remind_date < today:
                remind_date = date(today.year + 1, formation_date.month, formation_date.day)
            return remind_date
        else:
            # Fallback: 90 days from today
            return today + timedelta(days=90)

    # Fixed date reminder
    remind_date = date(today.year, month, day)

    # If date has passed this year, schedule for next year
    if remind_date < today:
        remind_date = date(today.year + 1, month, day)

    return remind_date


def create_business_reminders(
    db: DBSession,
    item_id: str,
    org_id: str,
    user_id: str,
    entity_type: str,
    state: str | None = None,
    formation_date: date | None = None,
    has_employees: bool = False,
    is_s_corp: bool = False,
) -> list[str]:
    """Auto-generate tax and compliance reminders for a business entity.

    Args:
        db: Database session
        item_id: ID of the business item
        org_id: Organization ID
        user_id: User creating the reminders
        entity_type: "llc", "corporation", "partnership", "sole_proprietorship"
        state: State of formation/incorporation
        formation_date: Date business was formed (for anniversary-based reminders)
        has_employees: Whether business has employees (adds payroll tax reminders)
        is_s_corp: Whether corporation has S-Corp election (changes tax reminders)

    Returns:
        List of created reminder IDs
    """
    created_ids = []

    # Only create reminders for LLCs and Corporations
    if entity_type not in ["llc", "corporation"]:
        return created_ids

    # Delete existing auto-generated business tax reminders for this item to prevent duplicates
    # Keep user-created custom reminders and user-edited reminders (is_auto_generated=False)
    db.query(CustomReminder).filter(
        CustomReminder.item_id == item_id,
        CustomReminder.org_id == org_id,
        CustomReminder.is_auto_generated == True  # noqa: E712
    ).delete()

    db.flush()  # Flush deletes before creating new ones

    # Determine which federal tax reminders to use
    if entity_type == "corporation" and is_s_corp:
        # S-Corp overrides standard corporation reminders
        federal_reminders = S_CORP_REMINDERS
    else:
        federal_reminders = FEDERAL_TAX_REMINDERS.get(entity_type, [])

    # Create federal tax reminders
    for template in federal_reminders:
        remind_date = _calculate_reminder_date(
            template["month"],
            template["day"],
            formation_date
        )

        reminder = CustomReminder(
            id=str(uuid4()),
            item_id=item_id,
            org_id=org_id,
            created_by=user_id,
            title=template["title"],
            remind_date=remind_date,
            note=template["note"],
            repeat=template.get("repeat"),
            email_sent=False,
            is_auto_generated=True,
            remind_days_before=7,
        )
        db.add(reminder)
        created_ids.append(reminder.id)

    # Add employment tax reminders if business has employees
    if has_employees:
        for template in EMPLOYMENT_TAX_REMINDERS:
            remind_date = _calculate_reminder_date(
                template["month"],
                template["day"],
                formation_date
            )

            reminder = CustomReminder(
                id=str(uuid4()),
                item_id=item_id,
                org_id=org_id,
                created_by=user_id,
                title=template["title"],
                remind_date=remind_date,
                note=template["note"],
                repeat=template.get("repeat"),
                email_sent=False,
                is_auto_generated=True,
                remind_days_before=7,
            )
            db.add(reminder)
            created_ids.append(reminder.id)

    # Add state-specific compliance reminders
    if state and state in STATE_COMPLIANCE_REMINDERS:
        state_reminders = STATE_COMPLIANCE_REMINDERS[state].get(entity_type, [])

        for template in state_reminders:
            remind_date = _calculate_reminder_date(
                template["month"],
                template["day"],
                formation_date
            )

            reminder = CustomReminder(
                id=str(uuid4()),
                item_id=item_id,
                org_id=org_id,
                created_by=user_id,
                title=template["title"],
                remind_date=remind_date,
                note=template["note"],
                repeat=template.get("repeat"),
                email_sent=False,
                is_auto_generated=True,
                remind_days_before=7,
            )
            db.add(reminder)
            created_ids.append(reminder.id)

    db.commit()
    return created_ids
