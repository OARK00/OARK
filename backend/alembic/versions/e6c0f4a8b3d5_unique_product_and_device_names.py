"""one name per organisation for products and devices

Revision ID: e6c0f4a8b3d5
Revises: e2b7d9c1a4f6
Create Date: 2026-10-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e6c0f4a8b3d5'
down_revision: Union[str, None] = 'e2b7d9c1a4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ('products', 'devices')
TIDY = r"regexp_replace(btrim(name), '\s+', ' ', 'g')"


def upgrade() -> None:
    conn = op.get_bind()
    for table in TABLES:
        # Names created before the app tidied them: the same clean-up the app
        # now does on save (no spaces at the ends, single spaces inside).
        conn.execute(sa.text(f"UPDATE {table} SET name = {TIDY} WHERE name <> {TIDY}"))

        # Checked before anything is created, so a database that still holds
        # duplicates is left exactly as it was and the reason is readable in
        # the deploy log. Counts only: names are the customer's data.
        duplicates = conn.execute(
            sa.text(
                f"SELECT count(*) FROM (SELECT 1 FROM {table} "
                "GROUP BY org_id, lower(name) HAVING count(*) > 1) AS repeated"
            )
        ).scalar()
        if duplicates:
            raise RuntimeError(
                f"{duplicates} name(s) are used more than once in {table} within one organisation. "
                "Rename or delete the extras, then deploy again. Nothing was changed."
            )

    # The app already refuses a duplicate; this closes the gap when two
    # requests create the same name at the same moment.
    for table in TABLES:
        op.create_index(f'uq_{table}_org_name', table, ['org_id', sa.text('lower(name)')], unique=True)


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f'uq_{table}_org_name', table_name=table)
