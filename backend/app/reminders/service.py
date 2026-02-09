from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session as DBSession

from app.categories.definitions import CATEGORIES, REMINDER_FIELD_KEYS
from app.items.models import Item, ItemFieldValue
from app.reminders.models import CustomReminder


def _parse_date(value: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def get_reminders(db: DBSession, org_id: str, days_ahead: int = 90) -> list[dict]:
    """Get items with expiration/end dates within the next N days,
    merged with any custom reminders."""
    today = date.today()
    cutoff = today + timedelta(days=days_ahead)

    # --- Auto-detected reminders from date fields ---
    field_values = (
        db.query(ItemFieldValue)
        .join(Item)
        .filter(
            Item.org_id == org_id,
            Item.is_archived == False,
            ItemFieldValue.field_key.in_(REMINDER_FIELD_KEYS),
            ItemFieldValue.field_value.isnot(None),
        )
        .all()
    )

    reminders = []
    for fv in field_values:
        d = _parse_date(fv.field_value)
        if d is None:
            continue
        if d <= cutoff:
            # Look up the field label from definitions
            cat_def = CATEGORIES.get(fv.item.category, {})
            sub_def = cat_def.get("subcategories", {}).get(fv.item.subcategory, {})
            field_label = fv.field_key
            for f in sub_def.get("fields", []):
                if f["key"] == fv.field_key:
                    field_label = f["label"]
                    break

            days_until = (d - today).days
            reminders.append({
                "item_id": fv.item.id,
                "item_name": fv.item.name,
                "category": fv.item.category,
                "subcategory": fv.item.subcategory,
                "field_label": field_label,
                "date": d.isoformat(),
                "days_until": days_until,
                "is_overdue": days_until < 0,
                "is_custom": False,
            })

    # --- Custom reminders ---
    custom_query = (
        db.query(CustomReminder)
        .join(Item, CustomReminder.item_id == Item.id)
        .filter(
            CustomReminder.org_id == org_id,
            Item.is_archived == False,
        )
    )
    if days_ahead > 0:
        custom_query = custom_query.filter(
            CustomReminder.remind_date <= cutoff,
        )

    for cr in custom_query.all():
        days_until = (cr.remind_date - today).days
        # For "overdue" listing (days_ahead=0), only include overdue ones
        if days_ahead == 0 and days_until >= 0:
            continue
        reminders.append({
            "id": cr.id,
            "item_id": cr.item.id,
            "item_name": cr.item.name,
            "category": cr.item.category,
            "subcategory": cr.item.subcategory,
            "field_label": cr.title,
            "date": cr.remind_date.isoformat(),
            "days_until": days_until,
            "is_overdue": days_until < 0,
            "is_custom": True,
            "is_auto_generated": cr.is_auto_generated,
            "remind_days_before": cr.remind_days_before,
            "note": cr.note,
            "repeat": cr.repeat,
        })

    reminders.sort(key=lambda r: r["days_until"])
    return reminders


def get_all_reminders_for_item(
    db: DBSession, item_id: str, org_id: str
) -> list[dict]:
    """Get ALL reminders for a specific item (auto-detected + custom)."""
    today = date.today()
    results: list[dict] = []

    # --- Auto-detected reminders from date fields ---
    field_values = (
        db.query(ItemFieldValue)
        .join(Item)
        .filter(
            Item.id == item_id,
            Item.org_id == org_id,
            ItemFieldValue.field_key.in_(REMINDER_FIELD_KEYS),
            ItemFieldValue.field_value.isnot(None),
        )
        .all()
    )
    for fv in field_values:
        d = _parse_date(fv.field_value)
        if d is None:
            continue
        cat_def = CATEGORIES.get(fv.item.category, {})
        sub_def = cat_def.get("subcategories", {}).get(fv.item.subcategory, {})
        field_label = fv.field_key
        for f in sub_def.get("fields", []):
            if f["key"] == fv.field_key:
                field_label = f["label"]
                break
        days_until = (d - today).days
        results.append({
            "item_id": fv.item.id,
            "item_name": fv.item.name,
            "category": fv.item.category,
            "subcategory": fv.item.subcategory,
            "field_label": field_label,
            "date": d.isoformat(),
            "days_until": days_until,
            "is_overdue": days_until < 0,
            "is_custom": False,
        })

    # --- Custom reminders ---
    custom = (
        db.query(CustomReminder)
        .join(Item, CustomReminder.item_id == Item.id)
        .filter(
            CustomReminder.item_id == item_id,
            CustomReminder.org_id == org_id,
        )
        .order_by(CustomReminder.remind_date.asc())
        .all()
    )
    for cr in custom:
        days_until = (cr.remind_date - today).days
        results.append({
            "id": cr.id,
            "item_id": cr.item.id,
            "item_name": cr.item.name,
            "category": cr.item.category,
            "subcategory": cr.item.subcategory,
            "field_label": cr.title,
            "date": cr.remind_date.isoformat(),
            "days_until": days_until,
            "is_overdue": days_until < 0,
            "is_custom": True,
            "is_auto_generated": cr.is_auto_generated,
            "remind_days_before": cr.remind_days_before,
            "note": cr.note,
            "repeat": cr.repeat,
        })

    results.sort(key=lambda r: r["days_until"])
    return results


def get_due_reminders_for_email(db: DBSession) -> list[CustomReminder]:
    """Get all custom reminders that are due and haven't been emailed yet.

    A reminder is considered due if:
    today >= (remind_date - remind_days_before)
    """
    today = date.today()
    all_pending = (
        db.query(CustomReminder)
        .filter(CustomReminder.email_sent == False)
        .all()
    )

    # Filter reminders where notification should be sent
    due_reminders = []
    for cr in all_pending:
        notification_date = cr.remind_date - timedelta(days=cr.remind_days_before)
        if today >= notification_date:
            due_reminders.append(cr)

    return due_reminders
