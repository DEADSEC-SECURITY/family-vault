"""Add index on field_key in item_field_values

Revision ID: 014
Revises: 013
Create Date: 2026-02-10

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '014'
down_revision: Union[str, None] = '013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_item_field_values_field_key', 'item_field_values', ['field_key'])


def downgrade() -> None:
    op.drop_index('ix_item_field_values_field_key', table_name='item_field_values')
