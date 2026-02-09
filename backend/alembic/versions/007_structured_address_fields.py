"""Add structured address fields to item_contacts

Revision ID: 007
Revises: 006
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "item_contacts",
        sa.Column("address_line1", sa.String(255), nullable=True),
    )
    op.add_column(
        "item_contacts",
        sa.Column("address_line2", sa.String(255), nullable=True),
    )
    op.add_column(
        "item_contacts",
        sa.Column("address_city", sa.String(100), nullable=True),
    )
    op.add_column(
        "item_contacts",
        sa.Column("address_state", sa.String(100), nullable=True),
    )
    op.add_column(
        "item_contacts",
        sa.Column("address_zip", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("item_contacts", "address_zip")
    op.drop_column("item_contacts", "address_state")
    op.drop_column("item_contacts", "address_city")
    op.drop_column("item_contacts", "address_line2")
    op.drop_column("item_contacts", "address_line1")
