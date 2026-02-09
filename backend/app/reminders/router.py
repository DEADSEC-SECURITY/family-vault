from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user
from app.items.models import Item
from app.orgs.service import get_user_orgs
from app.reminders.models import CustomReminder
from app.reminders.schemas import CustomReminderCreate, CustomReminderUpdate
from app.reminders.service import (
    get_all_reminders_for_item,
    get_reminders,
)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _get_active_org_id(user: User, db: DBSession) -> str:
    orgs = get_user_orgs(db, user.id)
    if not orgs:
        raise HTTPException(status_code=400, detail="No organization found")
    return orgs[0].id


@router.get("")
def list_reminders(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    return get_reminders(db, org_id, days_ahead=90)


@router.get("/overdue")
def list_overdue(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    all_reminders = get_reminders(db, org_id, days_ahead=0)
    return [r for r in all_reminders if r["is_overdue"]]


# ── Custom reminder CRUD ──────────────────────────────────────────


@router.get("/custom")
def list_custom_reminders(
    item_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    return get_all_reminders_for_item(db, item_id, org_id)


@router.post("/custom", status_code=201)
def create_custom_reminder(
    data: CustomReminderCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)

    # Verify item belongs to user's org
    item = (
        db.query(Item)
        .filter(Item.id == data.item_id, Item.org_id == org_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    reminder = CustomReminder(
        item_id=data.item_id,
        org_id=org_id,
        created_by=user.id,
        title=data.title,
        remind_date=data.remind_date,
        note=data.note,
        repeat=data.repeat,
        remind_days_before=data.remind_days_before,
        is_auto_generated=False,  # User-created reminders are not auto-generated
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    from datetime import date as date_type

    today = date_type.today()
    days_until = (reminder.remind_date - today).days

    return {
        "id": reminder.id,
        "item_id": reminder.item_id,
        "item_name": item.name,
        "category": item.category,
        "subcategory": item.subcategory,
        "field_label": reminder.title,
        "date": reminder.remind_date.isoformat(),
        "days_until": days_until,
        "is_overdue": days_until < 0,
        "is_custom": True,
        "note": reminder.note,
        "repeat": reminder.repeat,
    }


@router.patch("/custom/{reminder_id}")
def update_custom_reminder(
    reminder_id: str,
    data: CustomReminderUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    reminder = (
        db.query(CustomReminder)
        .filter(
            CustomReminder.id == reminder_id,
            CustomReminder.org_id == org_id,
        )
        .first()
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    # Update fields if provided
    if data.title is not None:
        reminder.title = data.title
    if data.remind_date is not None:
        reminder.remind_date = data.remind_date
    if data.note is not None:
        reminder.note = data.note
    if data.repeat is not None:
        reminder.repeat = data.repeat
    if data.remind_days_before is not None:
        reminder.remind_days_before = data.remind_days_before

    # When user edits a reminder, it becomes a custom reminder (no longer auto-generated)
    if reminder.is_auto_generated:
        reminder.is_auto_generated = False

    db.commit()
    db.refresh(reminder)

    # Return updated reminder
    item = db.query(Item).filter(Item.id == reminder.item_id).first()
    from datetime import date as date_type

    today = date_type.today()
    days_until = (reminder.remind_date - today).days

    return {
        "id": reminder.id,
        "item_id": reminder.item_id,
        "item_name": item.name if item else "",
        "category": item.category if item else "",
        "subcategory": item.subcategory if item else "",
        "title": reminder.title,
        "remind_date": reminder.remind_date.isoformat(),
        "days_until": days_until,
        "is_overdue": days_until < 0,
        "is_custom": True,
        "is_auto_generated": reminder.is_auto_generated,
        "remind_days_before": reminder.remind_days_before,
        "note": reminder.note,
        "repeat": reminder.repeat,
    }


@router.delete("/custom/{reminder_id}", status_code=204)
def delete_custom_reminder(
    reminder_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = _get_active_org_id(user, db)
    reminder = (
        db.query(CustomReminder)
        .filter(
            CustomReminder.id == reminder_id,
            CustomReminder.org_id == org_id,
        )
        .first()
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    db.delete(reminder)
    db.commit()


@router.post("/generate-business-reminders/{item_id}", status_code=201)
def generate_business_reminders(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Generate tax and compliance reminders for an LLC or Corporation.

    Automatically reads has_employees and tax_election from the item's fields.
    Regenerates reminders each time it's called (deletes old auto-generated ones first).
    """
    org_id = _get_active_org_id(user, db)

    # Verify item exists and belongs to org
    item = (
        db.query(Item)
        .filter(Item.id == item_id, Item.org_id == org_id, Item.is_archived == False)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Only for business entities
    if item.category != "business":
        raise HTTPException(
            status_code=400, detail="Reminders can only be generated for business items"
        )

    # Only for LLCs and Corporations
    if item.subcategory not in ["llc", "corporation"]:
        raise HTTPException(
            status_code=400,
            detail="Reminders can only be generated for LLCs and Corporations",
        )

    # Get field values to extract state, formation date, has_employees, and tax_election
    from datetime import datetime
    from app.items.models import ItemFieldValue

    field_values = (
        db.query(ItemFieldValue)
        .filter(ItemFieldValue.item_id == item_id)
        .all()
    )

    state = None
    formation_date = None
    has_employees = False
    is_s_corp = False

    for fv in field_values:
        if fv.field_key in ["state_of_formation", "state_of_incorporation"]:
            state = fv.field_value
        elif fv.field_key == "formation_date":
            try:
                formation_date = datetime.fromisoformat(fv.field_value).date()
            except:
                pass
        elif fv.field_key == "has_employees":
            has_employees = fv.field_value == "yes"
        elif fv.field_key == "tax_election":
            is_s_corp = fv.field_value == "s_corp"

    # Delete existing auto-generated reminders for this item before creating new ones
    db.query(CustomReminder).filter(
        CustomReminder.item_id == item_id,
        CustomReminder.is_auto_generated == True
    ).delete()
    db.commit()

    # Generate reminders
    from app.business_reminders.service import create_business_reminders

    reminder_ids = create_business_reminders(
        db=db,
        item_id=item_id,
        org_id=org_id,
        user_id=user.id,
        entity_type=item.subcategory,
        state=state,
        formation_date=formation_date,
        has_employees=has_employees,
        is_s_corp=is_s_corp,
    )

    return {
        "message": f"Generated {len(reminder_ids)} reminders",
        "reminder_ids": reminder_ids,
    }
