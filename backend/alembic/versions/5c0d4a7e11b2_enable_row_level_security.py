"""enable row level security on all tables

Revision ID: 5c0d4a7e11b2
Revises: 3f1a9c2e7b40
Create Date: 2026-09-21 10:00:00.000000

Supabase publishes an automatic REST API over the `public` schema, reachable
with the project's anon key. Row Level Security with no policies is what
closes that door: every role except the table owner is denied. Oark's backend
connects as `postgres`, the owner, which bypasses RLS, so nothing in the app
changes -- but nothing outside Oark can read these tables any more.
"""
from typing import Sequence, Union

from alembic import op

revision: str = '5c0d4a7e11b2'
down_revision: Union[str, None] = '3f1a9c2e7b40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = (
    "organizations",
    "users",
    "products",
    "devices",
    "telemetry_readings",
    "oark_environment",
    "alembic_version",
)


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
