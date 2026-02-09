"""
vehicles/models.py — SQLAlchemy models for org-wide vehicle database.

Vehicles are org-scoped records (name, license_plate, VIN) that can be assigned
to multiple auto insurance items via the item_vehicles junction table.

TABLE: vehicles
  - id (PK, uuid)
  - org_id (FK → organizations.id)
  - name (str 100, NOT NULL)    — e.g. "2020 Toyota Camry"
  - license_plate (str 20)      — nullable
  - vin (str 17)                — nullable
  - acquired_date (date)        — nullable
  - owner_id (FK → people.id)   — nullable
  - primary_driver_id (FK → people.id) — nullable
  - created_at, updated_at

TABLE: item_vehicles (junction)
  - id (PK, uuid)
  - item_id (FK → items.id)
  - vehicle_id (FK → vehicles.id)
  - org_id (FK → organizations.id)
  - created_at
  - UNIQUE(item_id, vehicle_id)

MIGRATION HISTORY:
  008 — created both tables
  011 — added acquired_date, owner_id, primary_driver_id
"""
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    license_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True)
    acquired_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_id: Mapped[str | None] = mapped_column(
        ForeignKey("people.id", ondelete="SET NULL"), nullable=True, index=True
    )
    primary_driver_id: Mapped[str | None] = mapped_column(
        ForeignKey("people.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("Person", foreign_keys=[owner_id])
    primary_driver = relationship("Person", foreign_keys=[primary_driver_id])


class ItemVehicle(Base):
    __tablename__ = "item_vehicles"
    __table_args__ = (
        UniqueConstraint("item_id", "vehicle_id", name="uq_item_vehicle"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_id: Mapped[str] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    vehicle = relationship("Vehicle")
    item = relationship("Item")
