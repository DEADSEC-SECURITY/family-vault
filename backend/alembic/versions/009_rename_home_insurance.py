"""Rename home_insurance subcategory to homeowners_insurance

Revision ID: 009
Revises: 008
Create Date: 2026-02-07

"""
from typing import Sequence, Union

from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename existing home_insurance items to homeowners_insurance
    op.execute(
        "UPDATE items SET subcategory = 'homeowners_insurance' "
        "WHERE subcategory = 'home_insurance'"
    )
    # Also rename any coverage rows that reference the old subcategory
    # (coverage rows are linked by item_id, not subcategory, so no change needed there)


def downgrade() -> None:
    op.execute(
        "UPDATE items SET subcategory = 'home_insurance' "
        "WHERE subcategory = 'homeowners_insurance'"
    )
