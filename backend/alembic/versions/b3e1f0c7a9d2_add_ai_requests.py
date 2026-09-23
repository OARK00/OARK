"""add ai_requests

Revision ID: b3e1f0c7a9d2
Revises: 9d4c8f2a51e7
Create Date: 2026-09-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3e1f0c7a9d2'
down_revision: Union[str, None] = '9d4c8f2a51e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('ai_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('succeeded', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_requests_org_id'), 'ai_requests', ['org_id'], unique=False)
    op.create_index(op.f('ix_ai_requests_created_at'), 'ai_requests', ['created_at'], unique=False)
    op.execute("ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_requests_created_at'), table_name='ai_requests')
    op.drop_index(op.f('ix_ai_requests_org_id'), table_name='ai_requests')
    op.drop_table('ai_requests')
