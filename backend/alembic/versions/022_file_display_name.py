"""Add display_name column to file_attachments

Revision ID: 022
Revises: 021
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "file_attachments",
        sa.Column("display_name", sa.String(255), nullable=True),
    )
    # Populate existing rows with the original file_name
    op.execute("UPDATE file_attachments SET display_name = file_name")


def downgrade() -> None:
    op.drop_column("file_attachments", "display_name")
