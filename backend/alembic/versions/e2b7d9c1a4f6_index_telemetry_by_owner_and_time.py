"""index telemetry by organisation and time, and by device and time

Revision ID: e2b7d9c1a4f6
Revises: d5b9e3f7a2c4
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e2b7d9c1a4f6'
down_revision: Union[str, None] = 'd5b9e3f7a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # telemetry_readings is the table that grows without limit. The pages
    # that read it always ask "this organisation's (or this device's)
    # readings in this time range". With only single-column indexes the
    # database had to pick one and sift through the rest; these answer the
    # whole question from the index.
    #
    # Overview: messages per hour and per day for one organisation.
    op.create_index(
        'ix_telemetry_readings_org_recorded', 'telemetry_readings', ['org_id', 'recorded_at']
    )
    # Device page: one device's history, newest first.
    op.create_index(
        'ix_telemetry_readings_device_recorded', 'telemetry_readings', ['device_id', 'recorded_at']
    )


def downgrade() -> None:
    op.drop_index('ix_telemetry_readings_device_recorded', table_name='telemetry_readings')
    op.drop_index('ix_telemetry_readings_org_recorded', table_name='telemetry_readings')
