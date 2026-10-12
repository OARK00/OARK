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


def rename_repeats(conn, table: str) -> int:
    """Give every repeated name in one organisation a number: the oldest keeps
    its name, the next becomes "Name 2", then "Name 3". Nothing is deleted, so
    devices stay attached to the product they were made from.

    Returns how many rows were renamed.
    """
    rows = conn.execute(
        sa.text(f"SELECT id, org_id, name FROM {table} ORDER BY org_id, created_at, id")
    ).all()
    taken: dict = {}
    for _, org_id, name in rows:
        taken.setdefault(org_id, set()).add(name.lower())

    renamed = 0
    seen: dict = {}
    for row_id, org_id, name in rows:
        first_use = seen.setdefault(org_id, set())
        if name.lower() not in first_use:
            first_use.add(name.lower())
            continue
        # "Name 2" may itself be in use already; keep counting until one is free.
        number = 2
        while f"{name} {number}".lower() in taken[org_id]:
            number += 1
        new_name = f"{name} {number}"
        taken[org_id].add(new_name.lower())
        first_use.add(new_name.lower())
        conn.execute(sa.text(f"UPDATE {table} SET name = :name WHERE id = :id"), {"name": new_name, "id": row_id})
        renamed += 1
    return renamed


def upgrade() -> None:
    conn = op.get_bind()
    for table in TABLES:
        # Names created before the app tidied them: the same clean-up the app
        # now does on save (no spaces at the ends, single spaces inside).
        conn.execute(sa.text(f"UPDATE {table} SET name = {TIDY} WHERE name <> {TIDY}"))

        renamed = rename_repeats(conn, table)
        if renamed:
            # Counts only: names are the customer's data.
            print(f"Renamed {renamed} repeated name(s) in {table}")

        # A last check before anything is created: if a repeat is somehow
        # still there, the database is left exactly as it was and the reason
        # is readable in the deploy log.
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
