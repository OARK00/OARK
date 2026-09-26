"""add device_commands

Revision ID: c4a8d2e6f1b3
Revises: b3e1f0c7a9d2
Create Date: 2026-09-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c4a8d2e6f1b3'
down_revision: Union[str, None] = 'b3e1f0c7a9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('device_commands',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('device_id', sa.UUID(), nullable=False),
    sa.Column('key', sa.String(), nullable=False),
    sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(), server_default='pending', nullable=False),
    sa.Column('sent_by_user_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sent_by_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_device_commands_org_id'), 'device_commands', ['org_id'], unique=False)
    op.create_index(op.f('ix_device_commands_created_at'), 'device_commands', ['created_at'], unique=False)
    op.create_index('ix_device_commands_device_status', 'device_commands', ['device_id', 'status'], unique=False)
    op.execute("ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index('ix_device_commands_device_status', table_name='device_commands')
    op.drop_index(op.f('ix_device_commands_created_at'), table_name='device_commands')
    op.drop_index(op.f('ix_device_commands_org_id'), table_name='device_commands')
    op.drop_table('device_commands')
