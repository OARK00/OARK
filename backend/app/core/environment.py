"""Environment fence.

Every database carries one label row ("development", "test" or
"production"), and every running copy of Oark has APP_ENV. The two must
match, or the app and migrations refuse to run. The label lives inside the
database itself, so pasting the wrong DATABASE_URL is caught no matter
where the URL came from.
"""
from sqlalchemy import inspect, select
from sqlalchemy.engine import Connection

from app.core.config import settings
from app.models.environment import EnvironmentLabel

LABEL_COMMAND = "python label_database.py <environment>"


class EnvironmentMismatch(RuntimeError):
    pass


def read_label(conn: Connection) -> str | None:
    """The database's label, or None if it has never been labelled."""
    if not inspect(conn).has_table(EnvironmentLabel.__tablename__):
        return None
    return conn.execute(select(EnvironmentLabel.environment)).scalar()


def check_label(label: str | None, app_env: str, allow_unlabelled: bool) -> None:
    """Raise EnvironmentMismatch unless it is safe for `app_env` to use this database.

    label:            what the database says it is, e.g. "production",
                      or None for a database that was never labelled
    app_env:          what this running copy of Oark is (APP_ENV)
    allow_unlabelled: True for migrations, because a brand-new database has
                      to be migrated before it can be labelled; False for
                      the app itself
    """
    if label is None:
        if not allow_unlabelled:
            raise EnvironmentMismatch(
                f"This database carries no environment label, so Oark ({app_env}) will not "
                f"use it. If it is the right database and it is new, label it once with: "
                f"{LABEL_COMMAND}"
            )
        return
    if label != app_env:
        raise EnvironmentMismatch(
            f"Refusing to use this database: it is labelled '{label}' but this copy of Oark "
            f"is running as '{app_env}'. Point DATABASE_URL at the '{app_env}' database. "
            f"Never relabel a database to silence this."
        )


def assert_database_matches(conn: Connection, allow_unlabelled: bool = False) -> None:
    check_label(read_label(conn), settings.app_env, allow_unlabelled)
