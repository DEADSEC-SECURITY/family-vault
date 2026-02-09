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


class CustomReminderOut(BaseModel):
    id: str
    item_id: str
    item_name: str
    category: str
    subcategory: str
    title: str
    remind_date: str
    note: str | None
    repeat: str | None
    days_until: int
    is_overdue: bool
    is_custom: bool = True
    is_auto_generated: bool = False
    remind_days_before: int = 7

    model_config = {"from_attributes": True}
