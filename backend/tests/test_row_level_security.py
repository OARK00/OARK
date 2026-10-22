"""Every table in `public` must have Row Level Security switched on.

Supabase publishes an automatic API over the `public` schema. RLS with no
policies is what keeps that API out, while Oark's backend (the table owner)
is unaffected. Twice a new table was added without it; this test fails the
moment a migration forgets it again, instead of a Supabase warning weeks later.
"""
from sqlalchemy import text


def test_every_public_table_has_row_level_security(db_session):
    rows = db_session.execute(
        text("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'")
    ).fetchall()

    # Find the tables whose rowsecurity is False, and assert there are none.
    unprotected_tables = [name for name, rls in rows if not rls]
    assert unprotected_tables == [], f"RLS is off on: {', '.join(unprotected_tables)}"