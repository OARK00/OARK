"""Label the database in DATABASE_URL as belonging to one environment.

Run once per database, right after its first `alembic upgrade head`:

    python label_database.py development

A label can't be changed afterwards: a database that was production stays
production, so no command typed by mistake can turn it into something the
local app is allowed to write to.
"""
import os
import sys
from typing import get_args

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import insert  # noqa: E402

from app.core.config import AppEnv  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.core.environment import read_label  # noqa: E402
from app.models.environment import EnvironmentLabel  # noqa: E402


def main() -> None:
    allowed = get_args(AppEnv)
    if len(sys.argv) != 2 or sys.argv[1] not in allowed:
        sys.exit(f"Usage: python label_database.py <{'|'.join(allowed)}>")
    environment = sys.argv[1]

    with engine.begin() as conn:
        host = conn.engine.url.host
        current = read_label(conn)
        if current is None:
            conn.execute(insert(EnvironmentLabel).values(id=1, environment=environment))
            print(f"Labelled the database at {host} as '{environment}'.")
        elif current == environment:
            print(f"The database at {host} is already labelled '{environment}'. Nothing changed.")
        else:
            sys.exit(f"Refused: the database at {host} is labelled '{current}', and labels never change.")


if __name__ == "__main__":
    main()
