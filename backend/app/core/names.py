"""Names of products and devices: one per company.

"Helmet", "helmet" and "  Helmet " would look like the same thing in every
list, so they count as the same name. Each company has its own names: two
companies may both have a "Helmet".
"""
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session


def clean_name(name: str) -> str:
    """What gets saved: no spaces at the ends, single spaces inside."""
    return " ".join(name.split())


def name_key(name: str) -> str:
    """What gets compared: the clean name with capitals ignored."""
    # lower(), to match func.lower() on the database side of the comparison.
    return clean_name(name).lower()


def name_taken(kind: str, name: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f'A {kind} named "{name}" already exists. Choose another name.',
    )


def is_name_conflict(error: Exception) -> bool:
    """True when the database refused a row because of the one-name-per-
    organisation index, and not for some other reason."""
    return "_org_name" in str(getattr(error, "orig", error))


def ensure_name_is_free(db: Session, model: Any, org_id: uuid.UUID, name: str, kind: str) -> None:
    """Refuse with 409 when this company already has a `kind` with this name."""
    if not clean_name(name):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Give the {kind} a name.",
        )
    taken = (
        db.query(model.name)
        .filter(model.org_id == org_id, func.lower(model.name) == name_key(name))
        .first()
    )
    if taken:
        raise name_taken(kind, taken[0])
