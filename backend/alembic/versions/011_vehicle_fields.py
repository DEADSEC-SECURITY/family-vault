"""Add vehicle fields (acquired_date, owner, driver)

Revision ID: 011
Revises: 010
Create Date: 2024-02-08
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('vehicles', sa.Column('acquired_date', sa.Date, nullable=True))
    op.add_column('vehicles', sa.Column('owner_id', sa.String(36), sa.ForeignKey('people.id', ondelete='SET NULL'), nullable=True))
    op.add_column('vehicles', sa.Column('primary_driver_id', sa.String(36), sa.ForeignKey('people.id', ondelete='SET NULL'), nullable=True))
    
    op.create_index('ix_vehicles_owner_id', 'vehicles', ['owner_id'])
    op.create_index('ix_vehicles_primary_driver_id', 'vehicles', ['primary_driver_id'])


def downgrade() -> None:
    op.drop_index('ix_vehicles_primary_driver_id', 'vehicles')
    op.drop_index('ix_vehicles_owner_id', 'vehicles')
    op.drop_column('vehicles', 'primary_driver_id')
    op.drop_column('vehicles', 'owner_id')
    op.drop_column('vehicles', 'acquired_date')
