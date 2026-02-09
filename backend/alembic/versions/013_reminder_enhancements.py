"""Add is_auto_generated and remind_days_before to reminders

Revision ID: 013
Revises: 012
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013'
down_revision: Union[str, None] = '012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_auto_generated column (tracks if reminder was auto-generated from templates)
    op.add_column('custom_reminders', sa.Column('is_auto_generated', sa.Boolean(), nullable=False, server_default='false'))

    # Add remind_days_before column (how many days before remind_date to send notification)
    op.add_column('custom_reminders', sa.Column('remind_days_before', sa.Integer(), nullable=False, server_default='7'))


def downgrade() -> None:
    op.drop_column('custom_reminders', 'remind_days_before')
    op.drop_column('custom_reminders', 'is_auto_generated')
