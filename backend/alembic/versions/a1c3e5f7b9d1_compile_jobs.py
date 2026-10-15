"""compile jobs: one row per press of Verify

Revision ID: a1c3e5f7b9d1
Revises: f3a1c5e7b9d2
Create Date: 2026-10-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1c3e5f7b9d1'
down_revision: Union[str, None] = 'f3a1c5e7b9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'compile_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('board', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('output', sa.Text(), nullable=False),
        sa.Column('firmware', sa.LargeBinary(), nullable=True),
        sa.Column('firmware_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_compile_jobs_org_id', 'compile_jobs', ['org_id'])
    op.create_index('ix_compile_jobs_product_id', 'compile_jobs', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_compile_jobs_product_id', table_name='compile_jobs')
    op.drop_index('ix_compile_jobs_org_id', table_name='compile_jobs')
    op.drop_table('compile_jobs')
