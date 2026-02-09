"""
vehicles/router.py — FastAPI endpoints for org-wide vehicle database.

ENDPOINTS:
  GET    /api/vehicles                         — list all vehicles for user's org
  POST   /api/vehicles                         — create a new vehicle
  GET    /api/vehicles/{vehicle_id}            — get a single vehicle
  PATCH  /api/vehicles/{vehicle_id}            — update vehicle details
  DELETE /api/vehicles/{vehicle_id}            — delete vehicle (cascades to item_vehicles)
  GET    /api/vehicles/{vehicle_id}/policies   — get all policies associated with vehicle
  GET    /api/vehicles/item/{item_id}          — list vehicles assigned to an item
  POST   /api/vehicles/item/{item_id}          — assign a vehicle to an item
  DELETE /api/vehicles/item/{item_id}/{vehicle_id} — unassign a vehicle from an item

Vehicles are org-scoped. The same vehicle can be assigned to multiple auto insurance items.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession, joinedload

from app.auth.models import User
from app.database import get_db
from app.dependencies import get_current_user
from app.items.models import Item
from app.orgs.service import get_user_orgs
from app.people.models import Person
from app.vehicles.models import ItemVehicle, Vehicle
from app.vehicles.schemas import AssignVehicle, VehicleCreate, VehicleOut, VehicleUpdate

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


def _get_active_org_id(user: User, db: DBSession) -> str:
    """Get the first org the user belongs to."""
    orgs = get_user_orgs(db, user.id)
    if not orgs:
        raise HTTPException(status_code=400, detail="No organization found")
    return orgs[0].id


def _vehicle_to_out(vehicle: Vehicle) -> VehicleOut:
    """Convert Vehicle model to VehicleOut with computed fields."""
    return VehicleOut(
        id=vehicle.id,
        name=vehicle.name,
        license_plate=vehicle.license_plate,
        vin=vehicle.vin,
        acquired_date=vehicle.acquired_date.isoformat() if vehicle.acquired_date else None,
        owner_id=vehicle.owner_id,
        primary_driver_id=vehicle.primary_driver_id,
        owner_name=vehicle.owner.full_name if vehicle.owner else None,
        primary_driver_name=vehicle.primary_driver.full_name if vehicle.primary_driver else None,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
    )


# ── Org-wide vehicle CRUD ──────────────────────────────────────────


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List all vehicles in the user's org."""
    org_id = _get_active_org_id(user, db)
    vehicles = (
        db.query(Vehicle)
        .options(joinedload(Vehicle.owner), joinedload(Vehicle.primary_driver))
        .filter(Vehicle.org_id == org_id)
        .order_by(Vehicle.name.asc())
        .all()
    )
    return [_vehicle_to_out(v) for v in vehicles]


@router.post("", status_code=201, response_model=VehicleOut)
def create_vehicle(
    data: VehicleCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Create a new vehicle in the user's org."""
    org_id = _get_active_org_id(user, db)

    # Validate person IDs if provided
    if data.owner_id:
        owner = db.query(Person).filter(
            Person.id == data.owner_id, Person.org_id == org_id
        ).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner not found")

    if data.primary_driver_id:
        driver = db.query(Person).filter(
            Person.id == data.primary_driver_id, Person.org_id == org_id
        ).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Primary driver not found")

    # Parse acquired_date if provided
    acquired_date_obj = None
    if data.acquired_date:
        try:
            acquired_date_obj = date.fromisoformat(data.acquired_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for acquired_date")

    vehicle = Vehicle(
        org_id=org_id,
        name=data.name,
        license_plate=data.license_plate,
        vin=data.vin,
        acquired_date=acquired_date_obj,
        owner_id=data.owner_id,
        primary_driver_id=data.primary_driver_id,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    # Load relationships for response
    vehicle = (
        db.query(Vehicle)
        .options(joinedload(Vehicle.owner), joinedload(Vehicle.primary_driver))
        .filter(Vehicle.id == vehicle.id)
        .first()
    )
    return _vehicle_to_out(vehicle)


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get a single vehicle by ID."""
    org_id = _get_active_org_id(user, db)
    vehicle = (
        db.query(Vehicle)
        .options(joinedload(Vehicle.owner), joinedload(Vehicle.primary_driver))
        .filter(Vehicle.id == vehicle_id, Vehicle.org_id == org_id)
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return _vehicle_to_out(vehicle)


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: str,
    data: VehicleUpdate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Update a vehicle's details."""
    org_id = _get_active_org_id(user, db)
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.org_id == org_id)
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Validate person IDs if provided
    if data.owner_id is not None:
        if data.owner_id:  # If not empty string/null
            owner = db.query(Person).filter(
                Person.id == data.owner_id, Person.org_id == org_id
            ).first()
            if not owner:
                raise HTTPException(status_code=404, detail="Owner not found")
        vehicle.owner_id = data.owner_id

    if data.primary_driver_id is not None:
        if data.primary_driver_id:  # If not empty string/null
            driver = db.query(Person).filter(
                Person.id == data.primary_driver_id, Person.org_id == org_id
            ).first()
            if not driver:
                raise HTTPException(status_code=404, detail="Primary driver not found")
        vehicle.primary_driver_id = data.primary_driver_id

    # Parse and update acquired_date if provided
    if data.acquired_date is not None:
        if data.acquired_date:
            try:
                vehicle.acquired_date = date.fromisoformat(data.acquired_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format for acquired_date")
        else:
            vehicle.acquired_date = None

    if data.name is not None:
        vehicle.name = data.name
    if data.license_plate is not None:
        vehicle.license_plate = data.license_plate
    if data.vin is not None:
        vehicle.vin = data.vin

    db.commit()

    # Reload with relationships
    vehicle = (
        db.query(Vehicle)
        .options(joinedload(Vehicle.owner), joinedload(Vehicle.primary_driver))
        .filter(Vehicle.id == vehicle_id)
        .first()
    )
    return _vehicle_to_out(vehicle)


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Delete a vehicle from the org. Cascades to item_vehicles."""
    org_id = _get_active_org_id(user, db)
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.org_id == org_id)
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    db.delete(vehicle)
    db.commit()


@router.get("/{vehicle_id}/policies")
def get_vehicle_policies(
    vehicle_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Get all insurance items (policies) associated with this vehicle."""
    org_id = _get_active_org_id(user, db)

    # Verify vehicle exists and belongs to org
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id, Vehicle.org_id == org_id)
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Get all items linked to this vehicle
    items = (
        db.query(Item)
        .join(ItemVehicle, ItemVehicle.item_id == Item.id)
        .filter(
            ItemVehicle.vehicle_id == vehicle_id,
            ItemVehicle.org_id == org_id,
            Item.category == "insurance",
            Item.subcategory == "auto_insurance",
        )
        .order_by(Item.created_at.desc())
        .all()
    )

    # Return simplified item info
    return [
        {
            "id": item.id,
            "name": item.name,
            "is_archived": item.is_archived,
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat(),
        }
        for item in items
    ]


# ── Per-item vehicle assignment ────────────────────────────────────


@router.get("/item/{item_id}", response_model=list[VehicleOut])
def list_item_vehicles(
    item_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """List vehicles assigned to a specific item."""
    org_id = _get_active_org_id(user, db)

    # Verify item belongs to user's org
    item = db.query(Item).filter(Item.id == item_id, Item.org_id == org_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    vehicles = (
        db.query(Vehicle)
        .options(joinedload(Vehicle.owner), joinedload(Vehicle.primary_driver))
        .join(ItemVehicle, ItemVehicle.vehicle_id == Vehicle.id)
        .filter(ItemVehicle.item_id == item_id, ItemVehicle.org_id == org_id)
        .order_by(Vehicle.name.asc())
        .all()
    )
    return [_vehicle_to_out(v) for v in vehicles]


@router.post("/item/{item_id}", status_code=201, response_model=VehicleOut)
def assign_vehicle(
    item_id: str,
    data: AssignVehicle,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Assign an existing org vehicle to an item."""
    org_id = _get_active_org_id(user, db)

    # Verify item belongs to user's org
    item = db.query(Item).filter(Item.id == item_id, Item.org_id == org_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Verify vehicle belongs to user's org
    vehicle = (
        db.query(Vehicle)
        .options(joinedload(Vehicle.owner), joinedload(Vehicle.primary_driver))
        .filter(Vehicle.id == data.vehicle_id, Vehicle.org_id == org_id)
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Check for existing assignment
    existing = (
        db.query(ItemVehicle)
        .filter(
            ItemVehicle.item_id == item_id,
            ItemVehicle.vehicle_id == data.vehicle_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Vehicle already assigned to this item")

    link = ItemVehicle(
        item_id=item_id,
        vehicle_id=data.vehicle_id,
        org_id=org_id,
    )
    db.add(link)
    db.commit()

    return _vehicle_to_out(vehicle)


@router.delete("/item/{item_id}/{vehicle_id}", status_code=204)
def unassign_vehicle(
    item_id: str,
    vehicle_id: str,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Unassign a vehicle from an item (does not delete the vehicle)."""
    org_id = _get_active_org_id(user, db)
    link = (
        db.query(ItemVehicle)
        .filter(
            ItemVehicle.item_id == item_id,
            ItemVehicle.vehicle_id == vehicle_id,
            ItemVehicle.org_id == org_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Vehicle assignment not found")

    db.delete(link)
    db.commit()
