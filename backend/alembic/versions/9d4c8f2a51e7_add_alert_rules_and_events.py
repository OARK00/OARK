"""add alert rules and events

Revision ID: 9d4c8f2a51e7
Revises: 7a2b5e91c334
Create Date: 2026-09-22 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '9d4c8f2a51e7'
down_revision: Union[str, None] = '7a2b5e91c334'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('alert_rules',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('device_id', sa.UUID(), nullable=True),
    sa.Column('product_id', sa.UUID(), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('condition', sa.String(), nullable=False),
    sa.Column('data_key', sa.String(), nullable=True),
    sa.Column('threshold', sa.Float(), nullable=True),
    sa.Column('for_minutes', sa.Integer(), nullable=True),
    sa.Column('cooldown_minutes', sa.Integer(), server_default='15', nullable=False),
    sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_rules_org_id'), 'alert_rules', ['org_id'], unique=False)
    op.create_index(op.f('ix_alert_rules_device_id'), 'alert_rules', ['device_id'], unique=False)
    op.create_index(op.f('ix_alert_rules_product_id'), 'alert_rules', ['product_id'], unique=False)

    op.create_table('alert_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('org_id', sa.UUID(), nullable=False),
    sa.Column('rule_id', sa.UUID(), nullable=False),
    sa.Column('device_id', sa.UUID(), nullable=False),
    sa.Column('message', sa.String(), nullable=False),
    sa.Column('value', sa.Float(), nullable=True),
    sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['rule_id'], ['alert_rules.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_events_org_id'), 'alert_events', ['org_id'], unique=False)
    op.create_index(op.f('ix_alert_events_rule_id'), 'alert_events', ['rule_id'], unique=False)
    op.create_index(op.f('ix_alert_events_device_id'), 'alert_events', ['device_id'], unique=False)
    op.create_index(op.f('ix_alert_events_triggered_at'), 'alert_events', ['triggered_at'], unique=False)

    for table in ("alert_rules", "alert_events"):
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f('ix_alert_events_triggered_at'), table_name='alert_events')
    op.drop_index(op.f('ix_alert_events_device_id'), table_name='alert_events')
    op.drop_index(op.f('ix_alert_events_rule_id'), table_name='alert_events')
    op.drop_index(op.f('ix_alert_events_org_id'), table_name='alert_events')
    op.drop_table('alert_events')
    op.drop_index(op.f('ix_alert_rules_product_id'), table_name='alert_rules')
    op.drop_index(op.f('ix_alert_rules_device_id'), table_name='alert_rules')
    op.drop_index(op.f('ix_alert_rules_org_id'), table_name='alert_rules')
    op.drop_table('alert_rules')
