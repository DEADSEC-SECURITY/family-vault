from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CoverageRow(Base):
    __tablename__ = "coverage_rows"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_key: Mapped[str] = mapped_column(String(100), nullable=False)
    service_label: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Health insurance: in-network columns
    in_copay: Mapped[str | None] = mapped_column(String(50), nullable=True)
    in_coinsurance: Mapped[str | None] = mapped_column(String(50), nullable=True)
    in_deductible_applies: Mapped[str | None] = mapped_column(String(10), nullable=True)
    in_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Health insurance: out-of-network columns
    out_copay: Mapped[str | None] = mapped_column(String(50), nullable=True)
    out_coinsurance: Mapped[str | None] = mapped_column(String(50), nullable=True)
    out_deductible_applies: Mapped[str | None] = mapped_column(String(10), nullable=True)
    out_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Standard insurance: limit/deductible columns (auto, home, life)
    coverage_limit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deductible: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    item = relationship("Item")


class CoveragePlanLimit(Base):
    __tablename__ = "coverage_plan_limits"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    limit_key: Mapped[str] = mapped_column(String(100), nullable=False)
    limit_label: Mapped[str] = mapped_column(String(200), nullable=False)
    limit_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    item = relationship("Item")


class InNetworkProvider(Base):
    __tablename__ = "in_network_providers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_name: Mapped[str] = mapped_column(String(255), nullable=False)
    specialty: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    network_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    item = relationship("Item")
