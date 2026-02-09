"""Add coverage tables for insurance items

Revision ID: 005
Revises: 004
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Coverage rows — per-service coverage details
    op.create_table(
        "coverage_rows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "item_id",
            sa.String(36),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "org_id",
            sa.String(36),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("service_key", sa.String(100), nullable=False),
        sa.Column("service_label", sa.String(200), nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        # Health in-network
        sa.Column("in_copay", sa.String(50), nullable=True),
        sa.Column("in_coinsurance", sa.String(50), nullable=True),
        sa.Column("in_deductible_applies", sa.String(10), nullable=True),
        sa.Column("in_notes", sa.Text, nullable=True),
        # Health out-of-network
        sa.Column("out_copay", sa.String(50), nullable=True),
        sa.Column("out_coinsurance", sa.String(50), nullable=True),
        sa.Column("out_deductible_applies", sa.String(10), nullable=True),
        sa.Column("out_notes", sa.Text, nullable=True),
        # Standard coverage (auto/home/life)
        sa.Column("coverage_limit", sa.String(100), nullable=True),
        sa.Column("deductible", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Plan limits — health insurance plan-level limits
    op.create_table(
        "coverage_plan_limits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "item_id",
            sa.String(36),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "org_id",
            sa.String(36),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("limit_key", sa.String(100), nullable=False),
        sa.Column("limit_label", sa.String(200), nullable=False),
        sa.Column("limit_value", sa.String(100), nullable=True),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # In-network providers — manually-added providers/hospitals
    op.create_table(
        "in_network_providers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "item_id",
            sa.String(36),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "org_id",
            sa.String(36),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("provider_name", sa.String(255), nullable=False),
        sa.Column("specialty", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("network_tier", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("in_network_providers")
    op.drop_table("coverage_plan_limits")
    op.drop_table("coverage_rows")
