"""add device_commands.expires_at

Revision ID: d5b9e3f7a2c4
Revises: c4a8d2e6f1b3
Create Date: 2026-09-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd5b9e3f7a2c4'
down_revision: Union[str, None] = 'c4a8d2e6f1b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The server default keeps the previous release working while Render
    # swaps versions: its inserts don't name this column, and still get the
    # five minutes that release always used.
    op.add_column(
        'device_commands',
        sa.Column(
            'expires_at',
            sa.DateTime(timezone=True),
            server_default=sa.text("now() + interval '5 minutes'"),
            nullable=False,
        ),
    )
    op.execute("UPDATE device_commands SET expires_at = created_at + interval '5 minutes'")


def downgrade() -> None:
    op.drop_column('device_commands', 'expires_at')
