"""saved firmware code, one per product

Revision ID: f3a1c5e7b9d2
Revises: e6c0f4a8b3d5
Create Date: 2026-10-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f3a1c5e7b9d2'
down_revision: Union[str, None] = 'e6c0f4a8b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_sketches',
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('product_id'),
    )
    op.create_index('ix_product_sketches_org_id', 'product_sketches', ['org_id'])


def downgrade() -> None:
    op.drop_index('ix_product_sketches_org_id', table_name='product_sketches')
    op.drop_table('product_sketches')
