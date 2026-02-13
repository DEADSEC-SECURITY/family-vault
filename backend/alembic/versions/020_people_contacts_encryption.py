"""Add encryption_version to people, item_contacts, and saved_contacts

Revision ID: 020
Revises: 019
Create Date: 2026-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "people",
        sa.Column("encryption_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "item_contacts",
        sa.Column("encryption_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "saved_contacts",
        sa.Column("encryption_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("saved_contacts", "encryption_version")
    op.drop_column("item_contacts", "encryption_version")
    op.drop_column("people", "encryption_version")
