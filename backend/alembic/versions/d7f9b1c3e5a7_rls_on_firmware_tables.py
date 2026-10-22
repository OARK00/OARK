"""row level security on the firmware tables

Revision ID: d7f9b1c3e5a7
Revises: c4e6a8b0d2f5
Create Date: 2026-10-22 10:00:00.000000

product_sketches and compile_jobs were created without the
ENABLE ROW LEVEL SECURITY line every other table has (see 5c0d4a7e11b2), so
Supabase's Data API could reach them with the anon key. Enabling it twice is
harmless, so this is safe on a database where someone already switched it on.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd7f9b1c3e5a7'
down_revision: Union[str, None] = 'c4e6a8b0d2f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("product_sketches", "compile_jobs")


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
