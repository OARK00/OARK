"""add oark_environment label

Revision ID: 3f1a9c2e7b40
Revises: b8c7b96dd595
Create Date: 2026-09-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '3f1a9c2e7b40'
down_revision: Union[str, None] = 'b8c7b96dd595'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Created empty on purpose: labelling is a deliberate, one-time step
    # (label_database.py), never something a migration guesses.
    op.create_table('oark_environment',
    sa.Column('id', sa.Integer(), autoincrement=False, nullable=False),
    sa.Column('environment', sa.String(), nullable=False),
    sa.Column('labelled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('id = 1', name='oark_environment_single_row'),
    sa.CheckConstraint("environment IN ('development', 'test', 'production')", name='oark_environment_known_value'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('oark_environment')
