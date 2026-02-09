from sqlalchemy import or_
from sqlalchemy.orm import Session as DBSession, joinedload

from app.items.models import Item, ItemFieldValue
from app.items.service import _item_to_response
from app.items.schemas import ItemResponse


def search_items(
    db: DBSession, org_id: str, query: str, limit: int = 50
) -> list[ItemResponse]:
    """Search items by name or field values using ILIKE."""
    pattern = f"%{query}%"

    # Find item IDs matching the query in name or field values
    name_matches = (
        db.query(Item.id)
        .filter(
            Item.org_id == org_id,
            Item.is_archived == False,
            Item.name.ilike(pattern),
        )
        .all()
    )

    field_matches = (
        db.query(ItemFieldValue.item_id)
        .join(Item)
        .filter(
            Item.org_id == org_id,
            Item.is_archived == False,
            ItemFieldValue.field_value.ilike(pattern),
        )
        .all()
    )

    item_ids = list({row[0] for row in name_matches} | {row[0] for row in field_matches})

    if not item_ids:
        return []

    results = (
        db.query(Item)
        .options(joinedload(Item.field_values), joinedload(Item.files))
        .filter(Item.id.in_(item_ids))
        .order_by(Item.updated_at.desc())
        .limit(limit)
        .all()
    )
    # Deduplicate due to joinedload
    seen = set()
    items = []
    for item in results:
        if item.id not in seen:
            seen.add(item.id)
            items.append(item)

    return [_item_to_response(i) for i in items]
