from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession, joinedload

from app.categories.definitions import CATEGORIES
from app.contacts.models import ItemContact
from app.coverage.models import CoveragePlanLimit, CoverageRow, InNetworkProvider
from app.files.encryption import decrypt_field, encrypt_field
from app.items.models import Item, ItemFieldValue
from app.items.schemas import FieldValueIn, FieldValueOut, FileOut, ItemResponse
from app.orgs.models import Organization
from app.orgs.service import get_org_encryption_key
from app.vehicles.models import ItemVehicle


def _get_org_key(db: DBSession, org_id: str) -> bytes:
    """Fetch org and return its decrypted encryption key. Raises 404 if not found."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return get_org_encryption_key(org)


def _get_all_fields(sub_def: dict) -> list[dict]:
    """Get all fields from a subcategory definition.

    Handles both flat 'fields' array and nested 'field_groups' structure.
    """
    if "field_groups" in sub_def:
        # Flatten fields from all groups
        all_fields = []
        for group in sub_def["field_groups"]:
            all_fields.extend(group["fields"])
        return all_fields
    else:
        # Legacy flat fields structure
        return sub_def["fields"]


def _get_encrypted_fields(sub_def: dict) -> set[str]:
    """Get set of field keys that should be encrypted."""
    return {
        f["key"] for f in _get_all_fields(sub_def) if f.get("encrypted", False)
    }


def _validate_category(category: str, subcategory: str) -> dict:
    """Validate that category and subcategory exist. Returns the subcategory definition."""
    cat = CATEGORIES.get(category)
    if not cat:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    sub = cat["subcategories"].get(subcategory)
    if not sub:
        raise HTTPException(
            status_code=400, detail=f"Invalid subcategory: {subcategory}"
        )
    return sub


def _validate_fields(sub_def: dict, fields: list[FieldValueIn], check_required: bool = True) -> None:
    """Validate fields against the subcategory definition.

    If check_required is False, skip required field checks (used for auto-create
    and auto-save where the user fills fields incrementally).
    """
    if not check_required:
        return
    provided = {f.field_key: f.field_value for f in fields}
    for field_def in _get_all_fields(sub_def):
        if field_def["required"] and not provided.get(field_def["key"]):
            raise HTTPException(
                status_code=400,
                detail=f"Field '{field_def['label']}' is required",
            )


def _get_subcategory_def(category: str, subcategory: str) -> dict | None:
    """Look up subcategory definition without raising. Returns None if not found."""
    cat = CATEGORIES.get(category)
    if not cat:
        return None
    return cat["subcategories"].get(subcategory)


def _item_to_response(item: Item, org_key: bytes) -> ItemResponse:
    # Get subcategory definition to identify encrypted fields
    sub_def = _get_subcategory_def(item.category, item.subcategory)
    encrypted_fields = _get_encrypted_fields(sub_def) if sub_def else set()

    # Decrypt field values that are encrypted
    decrypted_fields = []
    for fv in item.field_values:
        field_value = fv.field_value
        if fv.field_key in encrypted_fields and field_value:
            field_value = decrypt_field(field_value, org_key)

        decrypted_fields.append(
            FieldValueOut(
                field_key=fv.field_key,
                field_value=field_value,
                field_type=fv.field_type,
            )
        )

    return ItemResponse(
        id=item.id,
        org_id=item.org_id,
        category=item.category,
        subcategory=item.subcategory,
        name=item.name,
        notes=item.notes,
        is_archived=item.is_archived,
        fields=decrypted_fields,
        files=[
            FileOut(
                id=f.id,
                file_name=f.file_name,
                file_size=f.file_size,
                mime_type=f.mime_type,
                purpose=f.purpose,
                created_at=f.created_at.isoformat(),
            )
            for f in item.files
        ],
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


def create_item(
    db: DBSession,
    org_id: str,
    user_id: str,
    category: str,
    subcategory: str,
    name: str,
    notes: str | None,
    fields: list[FieldValueIn],
) -> ItemResponse:
    sub_def = _validate_category(category, subcategory)
    # Skip required field checks on create — items are created instantly
    # and fields are filled in incrementally via auto-save
    _validate_fields(sub_def, fields, check_required=False)

    # Build field type lookup
    field_types = {f["key"]: f["type"] for f in _get_all_fields(sub_def)}

    # Get org encryption key once for encrypting sensitive fields
    org_key = _get_org_key(db, org_id)
    encrypted_fields = _get_encrypted_fields(sub_def)

    item = Item(
        org_id=org_id,
        created_by=user_id,
        category=category,
        subcategory=subcategory,
        name=name,
        notes=notes,
    )
    db.add(item)
    db.flush()

    for field in fields:
        if field.field_value is not None:
            # Encrypt field value if it's marked as encrypted
            field_value = field.field_value
            if field.field_key in encrypted_fields:
                field_value = encrypt_field(field_value, org_key)

            fv = ItemFieldValue(
                item_id=item.id,
                field_key=field.field_key,
                field_value=field_value,
                field_type=field_types.get(field.field_key, "text"),
            )
            db.add(fv)

    # Auto-generate tax and compliance reminders for business entities
    if category == "business" and subcategory in ["llc", "corporation"]:
        from datetime import datetime
        from app.business_reminders.service import create_business_reminders

        # Extract state and formation date from fields
        state = None
        formation_date = None
        for field in fields:
            if field.field_key in ["state_of_formation", "state_of_incorporation"] and field.field_value:
                state = field.field_value
            elif field.field_key == "formation_date" and field.field_value:
                try:
                    formation_date = datetime.fromisoformat(field.field_value).date()
                except (ValueError, TypeError):
                    pass

        # Generate reminders (users can delete ones they don't need)
        create_business_reminders(
            db=db,
            item_id=item.id,
            org_id=org_id,
            user_id=user_id,
            entity_type=subcategory,
            state=state,
            formation_date=formation_date,
            has_employees=False,  # Default to false, user can add manually
            is_s_corp=False,  # Default to false, user can add manually
        )

    db.commit()
    db.refresh(item)
    return _item_to_response(item, org_key)


def get_item(
    db: DBSession, item_id: str, org_id: str, include_archived: bool = False
) -> ItemResponse:
    query = (
        db.query(Item)
        .options(joinedload(Item.field_values), joinedload(Item.files))
        .filter(Item.id == item_id, Item.org_id == org_id)
    )
    if not include_archived:
        query = query.filter(Item.is_archived == False)
    item = query.first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    org_key = _get_org_key(db, org_id)
    return _item_to_response(item, org_key)


def list_items(
    db: DBSession,
    org_id: str,
    category: str | None = None,
    subcategory: str | None = None,
    page: int = 1,
    limit: int = 50,
    include_archived: bool = False,
) -> tuple[list[ItemResponse], int]:
    query = db.query(Item).filter(Item.org_id == org_id)
    if not include_archived:
        query = query.filter(Item.is_archived == False)

    if category:
        query = query.filter(Item.category == category)
    if subcategory:
        query = query.filter(Item.subcategory == subcategory)

    total = query.count()

    results = (
        query.options(joinedload(Item.field_values), joinedload(Item.files))
        .order_by(Item.created_at.desc())
        .offset((page - 1) * limit)
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

    # Fetch org key once for all items (fixes N+1 query)
    org_key = _get_org_key(db, org_id)
    return [_item_to_response(i, org_key) for i in items], total


def update_item(
    db: DBSession,
    item_id: str,
    org_id: str,
    name: str | None,
    notes: str | None,
    fields: list[FieldValueIn] | None,
) -> ItemResponse:
    item = (
        db.query(Item)
        .options(joinedload(Item.field_values), joinedload(Item.files))
        .filter(Item.id == item_id, Item.org_id == org_id, Item.is_archived == False)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if name is not None:
        item.name = name
    if notes is not None:
        item.notes = notes

    # Get org key once — used for both field encryption and response decryption
    org_key = _get_org_key(db, org_id)

    if fields is not None:
        sub_def = _get_subcategory_def(item.category, item.subcategory)
        if not sub_def:
            raise HTTPException(status_code=400, detail=f"Invalid subcategory: {item.subcategory}")
        # Skip required field checks — auto-save sends partial data
        _validate_fields(sub_def, fields, check_required=False)
        field_types = {f["key"]: f["type"] for f in _get_all_fields(sub_def)}
        encrypted_fields = _get_encrypted_fields(sub_def)

        # Delete existing field values and replace
        db.query(ItemFieldValue).filter(ItemFieldValue.item_id == item.id).delete()
        for field in fields:
            if field.field_value is not None:
                # Encrypt field value if it's marked as encrypted
                field_value = field.field_value
                if field.field_key in encrypted_fields:
                    field_value = encrypt_field(field_value, org_key)

                fv = ItemFieldValue(
                    item_id=item.id,
                    field_key=field.field_key,
                    field_value=field_value,
                    field_type=field_types.get(field.field_key, "text"),
                )
                db.add(fv)

    db.commit()
    db.refresh(item)
    return _item_to_response(item, org_key)


def delete_item(db: DBSession, item_id: str, org_id: str) -> None:
    item = (
        db.query(Item)
        .filter(Item.id == item_id, Item.org_id == org_id, Item.is_archived == False)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_archived = True
    db.commit()


def renew_item(
    db: DBSession, item_id: str, org_id: str, user_id: str
) -> ItemResponse:
    """Renew an auto insurance policy.

    1. Set old item's end_date to today and archive it.
    2. Create a new item with same settings (provider, policy_number, premium),
       start_date=today, end_date=today+6months.
    3. Copy vehicles, contacts, coverage rows, plan limits, and in-network providers.
    """
    # --- Fetch old item ---
    old_item = (
        db.query(Item)
        .options(joinedload(Item.field_values), joinedload(Item.files))
        .filter(
            Item.id == item_id,
            Item.org_id == org_id,
            Item.is_archived == False,
        )
        .first()
    )
    if not old_item:
        raise HTTPException(status_code=404, detail="Item not found")

    if old_item.subcategory != "auto_insurance":
        raise HTTPException(
            status_code=400, detail="Only auto insurance items can be renewed"
        )

    today = date.today()
    end_date = today + timedelta(days=183)  # ~6 months

    # --- Archive old item: set end_date to today ---
    for fv in old_item.field_values:
        if fv.field_key == "end_date":
            fv.field_value = today.isoformat()
    old_item.is_archived = True

    # --- Create new item ---
    new_item = Item(
        org_id=org_id,
        created_by=user_id,
        category=old_item.category,
        subcategory=old_item.subcategory,
        name=old_item.name,
        notes=old_item.notes,
    )
    db.add(new_item)
    db.flush()

    # --- Copy field values with date overrides ---
    sub_def = CATEGORIES.get(old_item.category, {}).get(
        "subcategories", {}
    ).get(old_item.subcategory, {})
    field_types = {f["key"]: f["type"] for f in sub_def.get("fields", [])}

    # Fields to copy from old item (everything except dates)
    date_overrides = {
        "start_date": today.isoformat(),
        "end_date": end_date.isoformat(),
    }

    copied_keys: set[str] = set()
    for fv in old_item.field_values:
        value = date_overrides.get(fv.field_key, fv.field_value)
        if value is not None:
            new_fv = ItemFieldValue(
                item_id=new_item.id,
                field_key=fv.field_key,
                field_value=value,
                field_type=field_types.get(fv.field_key, fv.field_type),
            )
            db.add(new_fv)
            copied_keys.add(fv.field_key)

    # Ensure start_date and end_date are always set even if not on old item
    for key, value in date_overrides.items():
        if key not in copied_keys:
            new_fv = ItemFieldValue(
                item_id=new_item.id,
                field_key=key,
                field_value=value,
                field_type=field_types.get(key, "date"),
            )
            db.add(new_fv)

    # --- Copy vehicle assignments ---
    old_vehicles = (
        db.query(ItemVehicle)
        .filter(ItemVehicle.item_id == item_id, ItemVehicle.org_id == org_id)
        .all()
    )
    for iv in old_vehicles:
        new_iv = ItemVehicle(
            item_id=new_item.id,
            vehicle_id=iv.vehicle_id,
            org_id=org_id,
        )
        db.add(new_iv)

    # --- Copy contacts ---
    old_contacts = (
        db.query(ItemContact)
        .filter(ItemContact.item_id == item_id, ItemContact.org_id == org_id)
        .all()
    )
    for c in old_contacts:
        new_c = ItemContact(
            item_id=new_item.id,
            org_id=org_id,
            label=c.label,
            value=c.value,
            contact_type=c.contact_type,
            sort_order=c.sort_order,
            address_line1=c.address_line1,
            address_line2=c.address_line2,
            address_city=c.address_city,
            address_state=c.address_state,
            address_zip=c.address_zip,
        )
        db.add(new_c)

    # --- Copy coverage rows ---
    old_rows = (
        db.query(CoverageRow)
        .filter(CoverageRow.item_id == item_id, CoverageRow.org_id == org_id)
        .all()
    )
    for row in old_rows:
        new_row = CoverageRow(
            item_id=new_item.id,
            org_id=org_id,
            service_key=row.service_key,
            service_label=row.service_label,
            sort_order=row.sort_order,
            in_copay=row.in_copay,
            in_coinsurance=row.in_coinsurance,
            in_deductible_applies=row.in_deductible_applies,
            in_notes=row.in_notes,
            out_copay=row.out_copay,
            out_coinsurance=row.out_coinsurance,
            out_deductible_applies=row.out_deductible_applies,
            out_notes=row.out_notes,
            coverage_limit=row.coverage_limit,
            deductible=row.deductible,
            notes=row.notes,
        )
        db.add(new_row)

    # --- Copy coverage plan limits ---
    old_limits = (
        db.query(CoveragePlanLimit)
        .filter(
            CoveragePlanLimit.item_id == item_id,
            CoveragePlanLimit.org_id == org_id,
        )
        .all()
    )
    for lim in old_limits:
        new_lim = CoveragePlanLimit(
            item_id=new_item.id,
            org_id=org_id,
            limit_key=lim.limit_key,
            limit_label=lim.limit_label,
            limit_value=lim.limit_value,
            sort_order=lim.sort_order,
        )
        db.add(new_lim)

    # --- Copy in-network providers ---
    old_providers = (
        db.query(InNetworkProvider)
        .filter(
            InNetworkProvider.item_id == item_id,
            InNetworkProvider.org_id == org_id,
        )
        .all()
    )
    for p in old_providers:
        new_p = InNetworkProvider(
            item_id=new_item.id,
            org_id=org_id,
            provider_name=p.provider_name,
            specialty=p.specialty,
            phone=p.phone,
            address=p.address,
            network_tier=p.network_tier,
            notes=p.notes,
        )
        db.add(new_p)

    db.commit()
    db.refresh(new_item)
    org_key = _get_org_key(db, org_id)
    return _item_to_response(new_item, org_key)
