"""Add zero-knowledge encryption columns and org_member_keys table

Revision ID: 019
Revises: 018
Create Date: 2026-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add zero-knowledge columns to users table
    op.add_column("users", sa.Column("encrypted_private_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("public_key", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("kdf_iterations", sa.Integer(), nullable=False, server_default="600000"),
    )
    op.add_column(
        "users",
        sa.Column("recovery_encrypted_private_key", sa.Text(), nullable=True),
    )

    # Create org_member_keys table for RSA-wrapped org keys
    op.create_table(
        "org_member_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "org_id",
            sa.String(36),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("encrypted_org_key", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("org_id", "user_id", name="uq_org_member_key"),
    )

    # Add encryption_version to items (1 = server-side, 2 = client-side)
    op.add_column(
        "items",
        sa.Column("encryption_version", sa.Integer(), nullable=False, server_default="1"),
    )
    # Add encrypted_name to items (for client-side encrypted item names)
    op.add_column("items", sa.Column("encrypted_name", sa.Text(), nullable=True))

    # Add encryption_version to file_attachments
    op.add_column(
        "file_attachments",
        sa.Column("encryption_version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("file_attachments", "encryption_version")
    op.drop_column("items", "encrypted_name")
    op.drop_column("items", "encryption_version")
    op.drop_table("org_member_keys")
    op.drop_column("users", "recovery_encrypted_private_key")
    op.drop_column("users", "kdf_iterations")
    op.drop_column("users", "public_key")
    op.drop_column("users", "encrypted_private_key")
