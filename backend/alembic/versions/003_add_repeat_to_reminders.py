"""Add repeat column to custom_reminders

Revision ID: 003
Revises: 002
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_reminders",
        sa.Column("repeat", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_reminders", "repeat")
