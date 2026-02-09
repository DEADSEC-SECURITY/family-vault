"""Dashboard stats router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.database import get_db
from app.dependencies import get_current_user
from app.auth.models import User
from app.items.models import Item, ItemFieldValue
from app.people.models import Person
from app.vehicles.models import Vehicle

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def calculate_annual_premium(premium_str: str | None, start_date_str: str | None, end_date_str: str | None) -> float:
    """Calculate annualized premium based on coverage period."""
    if not premium_str or not start_date_str or not end_date_str:
        return 0.0

    try:
        premium = float(premium_str)
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))

        # Calculate months in coverage period
        months_diff = (
            (end_date.year - start_date.year) * 12 +
            (end_date.month - start_date.month) +
            (end_date.day - start_date.day) / 30
        )

        if months_diff <= 0:
            return 0.0

        # Calculate annual premium: (premium / months) * 12
        annual_premium = (premium / months_diff) * 12
        return annual_premium
    except (ValueError, AttributeError):
        return 0.0


@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics."""
    # Get user's org_id (assuming user has only one org for now)
    from app.orgs.models import OrgMembership
    membership = db.query(OrgMembership).filter(OrgMembership.user_id == current_user.id).first()
    if not membership:
        return {
            "total_annual_premium": 0,
            "people_count": 0,
            "vehicles_count": 0,
            "policies_count": 0,
        }

    org_id = membership.org_id

    # Get all insurance items for the org
    insurance_items = db.query(Item).filter(
        Item.org_id == org_id,
        Item.category == "insurance",
        Item.is_archived == False,
    ).all()

    # Calculate total annual premiums
    total_annual_premium = 0.0
    for item in insurance_items:
        # Get premium, start_date, end_date fields
        fields = db.query(ItemFieldValue).filter(
            ItemFieldValue.item_id == item.id,
            ItemFieldValue.field_key.in_(["premium", "start_date", "end_date"])
        ).all()

        field_map = {f.field_key: f.field_value for f in fields}
        premium = field_map.get("premium")
        start_date = field_map.get("start_date")
        end_date = field_map.get("end_date")

        annual_premium = calculate_annual_premium(premium, start_date, end_date)
        total_annual_premium += annual_premium

    # Get counts
    people_count = db.query(func.count(Person.id)).filter(Person.org_id == org_id).scalar() or 0
    vehicles_count = db.query(func.count(Vehicle.id)).filter(Vehicle.org_id == org_id).scalar() or 0
    policies_count = len(insurance_items)

    return {
        "total_annual_premium": round(total_annual_premium, 2),
        "people_count": people_count,
        "vehicles_count": vehicles_count,
        "policies_count": policies_count,
    }
