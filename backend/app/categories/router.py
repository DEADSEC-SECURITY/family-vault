from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.categories.definitions import CATEGORIES, COVERAGE_DEFINITIONS
from app.categories.schemas import (
    CategoryListItem,
    CategoryResponse,
    FieldDefinition,
    FieldGroup,
    SubcategoryInfo,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.items.models import Item
from app.orgs.service import get_active_org_id

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _get_all_fields(sub: dict) -> list[dict]:
    """Get all fields from a subcategory definition.

    Handles both flat 'fields' array and nested 'field_groups' structure.
    """
    if "field_groups" in sub:
        # Flatten fields from all groups
        all_fields = []
        for group in sub["field_groups"]:
            all_fields.extend(group["fields"])
        return all_fields
    else:
        # Legacy flat fields structure
        return sub["fields"]


@router.get("", response_model=list[CategoryListItem])
def list_categories(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)

    # Get item counts per category
    counts = dict(
        db.query(Item.category, func.count(Item.id))
        .filter(Item.org_id == org_id, Item.is_archived == False)
        .group_by(Item.category)
        .all()
    )

    result = []
    for slug, cat in CATEGORIES.items():
        result.append(
            CategoryListItem(
                slug=slug,
                label=cat["label"],
                icon=cat["icon"],
                subcategory_count=len(cat["subcategories"]),
                total_items=counts.get(slug, 0),
            )
        )
    return result


@router.get("/{slug}", response_model=CategoryResponse)
def get_category(
    slug: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    cat = CATEGORIES.get(slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    org_id = get_active_org_id(user, db)

    # Get item counts per subcategory
    counts = dict(
        db.query(Item.subcategory, func.count(Item.id))
        .filter(
            Item.org_id == org_id,
            Item.category == slug,
            Item.is_archived == False,
        )
        .group_by(Item.subcategory)
        .all()
    )

    subcategories = []
    for sub_key, sub in cat["subcategories"].items():
        # Build field_groups if present in definition
        field_groups_data = None
        if "field_groups" in sub:
            field_groups_data = [
                FieldGroup(
                    label=group["label"],
                    fields=[FieldDefinition(**f) for f in group["fields"]]
                )
                for group in sub["field_groups"]
            ]

        subcategories.append(
            SubcategoryInfo(
                key=sub_key,
                label=sub["label"],
                icon=sub["icon"],
                fields=[FieldDefinition(**f) for f in _get_all_fields(sub)],
                field_groups=field_groups_data,
                file_slots=sub["file_slots"],
                recommended=sub["recommended"],
                item_count=counts.get(sub_key, 0),
                coverage_definition=COVERAGE_DEFINITIONS.get(sub_key),
            )
        )

    return CategoryResponse(
        slug=slug,
        label=cat["label"],
        icon=cat["icon"],
        subcategories=subcategories,
    )
