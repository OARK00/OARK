from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, func

from app.core.database import Base


class EnvironmentLabel(Base):
    """The single row saying which environment owns this database.

    Written once by label_database.py and checked on every start (see
    app/core/environment.py), so a wrong DATABASE_URL fails loudly instead of
    quietly writing development data into production.
    """

    __tablename__ = "oark_environment"
    __table_args__ = (
        CheckConstraint("id = 1", name="oark_environment_single_row"),
        CheckConstraint(
            "environment IN ('development', 'test', 'production')",
            name="oark_environment_known_value",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=False, default=1)
    environment = Column(String, nullable=False)
    labelled_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
