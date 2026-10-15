"""keep only the newest firmware per product

Revision ID: b2d4f6a8c0e3
Revises: a1c3e5f7b9d1
Create Date: 2026-10-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b2d4f6a8c0e3'
down_revision: Union[str, None] = 'a1c3e5f7b9d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app now drops older firmware after each successful compile. This
    # does the same once for the compiles made before that rule existed.
    op.execute(
        """
        UPDATE compile_jobs SET firmware = NULL
        WHERE firmware IS NOT NULL
          AND id NOT IN (
            SELECT DISTINCT ON (product_id) id FROM compile_jobs
            WHERE firmware IS NOT NULL
            ORDER BY product_id, created_at DESC, id DESC
          )
        """
    )


def downgrade() -> None:
    # Dropped firmware cannot be brought back; nothing to undo.
    pass
