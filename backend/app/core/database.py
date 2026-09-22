from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 declarative base.

    Models annotate their columns with Mapped[...], which is what lets mypy
    see device.name as a str instead of a Column object -- without it, type
    checking the code that uses models is mostly noise.
    """


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
