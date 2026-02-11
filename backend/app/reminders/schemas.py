from datetime import date

from pydantic import BaseModel


class CustomReminderCreate(BaseModel):
    item_id: str
    title: str
    remind_date: date
    note: str | None = None
    repeat: str | None = None  # none, weekly, monthly, quarterly, yearly
    remind_days_before: int = 7


class CustomReminderUpdate(BaseModel):
    title: str | None = None
    remind_date: date | None = None
    note: str | None = None
    repeat: str | None = None
    remind_days_before: int | None = None


class ReminderOut(BaseModel):
    """Unified schema for both auto-detected and custom reminders."""
    id: str | None = None
    item_id: str
    item_name: str
    category: str
    subcategory: str
    field_label: str
    date: date
    days_until: int
    is_overdue: bool
    is_custom: bool = False
    is_auto_generated: bool | None = None
    remind_days_before: int | None = None
    note: str | None = None
    repeat: str | None = None

    model_config = {"from_attributes": True}


# Keep backward compat alias
CustomReminderOut = ReminderOut
