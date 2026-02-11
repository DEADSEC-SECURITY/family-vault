"""
vehicles/schemas.py — Pydantic schemas for vehicle CRUD operations.

Schemas:
  VehicleCreate   — POST /api/vehicles body (name required, plate/vin optional)
  VehicleUpdate   — PATCH /api/vehicles/{id} body (all fields optional)
  VehicleOut      — response model for all vehicle endpoints
  AssignVehicle   — POST /api/vehicles/item/{item_id} body
"""
from datetime import date, datetime

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    name: str
    license_plate: str | None = None
    vin: str | None = None
    acquired_date: date | None = None
    owner_id: str | None = None
    primary_driver_id: str | None = None


class VehicleUpdate(BaseModel):
    name: str | None = None
    license_plate: str | None = None
    vin: str | None = None
    acquired_date: date | None = None
    owner_id: str | None = None
    primary_driver_id: str | None = None


class VehicleOut(BaseModel):
    id: str
    name: str
    license_plate: str | None = None
    vin: str | None = None
    acquired_date: date | None = None
    owner_id: str | None = None
    primary_driver_id: str | None = None
    owner_name: str | None = None  # computed field
    primary_driver_name: str | None = None  # computed field
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssignVehicle(BaseModel):
    vehicle_id: str
