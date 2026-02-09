from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from app.auth.models import User
from app.coverage.models import CoveragePlanLimit, CoverageRow, InNetworkProvider
from app.coverage.schemas import (
    CoverageRowOut,
    CoverageRowsBulk,
    InNetworkProviderCreate,
    InNetworkProviderOut,
    PlanLimitOut,
    PlanLimitsBulk,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.items.models import Item
from app.orgs.service import get_active_org_id

router = APIRouter(prefix="/api/coverage", tags=["coverage"])


def _verify_item(db: DBSession, item_id: str, org_id: str) -> Item:
    """Verify item exists and belongs to org."""
    item = (
        db.query(Item)
        .filter(Item.id == item_id, Item.org_id == org_id, Item.is_archived == False)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# ─── Coverage Rows ────────────────────────────────────────────

@router.get("/rows", response_model=list[CoverageRowOut])
def get_coverage_rows(
    item_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    _verify_item(db, item_id, org_id)
    rows = (
        db.query(CoverageRow)
        .filter(CoverageRow.item_id == item_id, CoverageRow.org_id == org_id)
        .order_by(CoverageRow.sort_order)
        .all()
    )
    return rows


@router.put("/rows", response_model=list[CoverageRowOut])
def upsert_coverage_rows(
    data: CoverageRowsBulk,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    _verify_item(db, data.item_id, org_id)

    # Delete existing rows and replace
    db.query(CoverageRow).filter(
        CoverageRow.item_id == data.item_id,
        CoverageRow.org_id == org_id,
    ).delete()

    new_rows = []
    for row in data.rows:
        cr = CoverageRow(
            item_id=data.item_id,
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
        db.add(cr)
        new_rows.append(cr)

    db.commit()
    for r in new_rows:
        db.refresh(r)
    return new_rows


# ─── Plan Limits ──────────────────────────────────────────────

@router.get("/limits", response_model=list[PlanLimitOut])
def get_plan_limits(
    item_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    _verify_item(db, item_id, org_id)
    limits = (
        db.query(CoveragePlanLimit)
        .filter(
            CoveragePlanLimit.item_id == item_id,
            CoveragePlanLimit.org_id == org_id,
        )
        .order_by(CoveragePlanLimit.sort_order)
        .all()
    )
    return limits


@router.put("/limits", response_model=list[PlanLimitOut])
def upsert_plan_limits(
    data: PlanLimitsBulk,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    _verify_item(db, data.item_id, org_id)

    # Delete existing limits and replace
    db.query(CoveragePlanLimit).filter(
        CoveragePlanLimit.item_id == data.item_id,
        CoveragePlanLimit.org_id == org_id,
    ).delete()

    new_limits = []
    for lim in data.limits:
        pl = CoveragePlanLimit(
            item_id=data.item_id,
            org_id=org_id,
            limit_key=lim.limit_key,
            limit_label=lim.limit_label,
            limit_value=lim.limit_value,
            sort_order=lim.sort_order,
        )
        db.add(pl)
        new_limits.append(pl)

    db.commit()
    for l in new_limits:
        db.refresh(l)
    return new_limits


# ─── In-Network Providers ────────────────────────────────────

@router.get("/providers", response_model=list[InNetworkProviderOut])
def get_in_network_providers(
    item_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    _verify_item(db, item_id, org_id)
    providers = (
        db.query(InNetworkProvider)
        .filter(
            InNetworkProvider.item_id == item_id,
            InNetworkProvider.org_id == org_id,
        )
        .order_by(InNetworkProvider.created_at.asc())
        .all()
    )
    return providers


@router.post("/providers", status_code=201, response_model=InNetworkProviderOut)
def create_in_network_provider(
    data: InNetworkProviderCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    _verify_item(db, data.item_id, org_id)

    provider = InNetworkProvider(
        item_id=data.item_id,
        org_id=org_id,
        provider_name=data.provider_name,
        specialty=data.specialty,
        phone=data.phone,
        address=data.address,
        network_tier=data.network_tier,
        notes=data.notes,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/providers/{provider_id}", status_code=204)
def delete_in_network_provider(
    provider_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    org_id = get_active_org_id(user, db)
    provider = (
        db.query(InNetworkProvider)
        .filter(
            InNetworkProvider.id == provider_id,
            InNetworkProvider.org_id == org_id,
        )
        .first()
    )
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    db.delete(provider)
    db.commit()
