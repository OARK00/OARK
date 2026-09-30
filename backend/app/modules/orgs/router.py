from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.modules.orgs.schemas import OrganizationResponse, OrganizationUpdate

router = APIRouter(prefix="/orgs", tags=["orgs"])


def get_own_org(db: Session, user: User) -> Organization:
    org = db.get(Organization, user.org_id)
    if org is None:
        # Users are deleted with their organisation (ON DELETE CASCADE), so
        # this only happens mid-deletion; answer as if the org is simply gone.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.get("/me", response_model=OrganizationResponse)
def read_org(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = get_own_org(db, current_user)
    return OrganizationResponse(id=org.id, name=org.name, created_at=org.created_at)


@router.patch("/me", response_model=OrganizationResponse)
def rename_org(
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # The name is what everyone in the organisation sees, so a member can
    # read it but only an owner or admin can change it.
    if current_user.role not in (UserRole.owner, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only an owner or admin can rename the company."
        )
    org = get_own_org(db, current_user)
    org.name = payload.name
    db.commit()
    db.refresh(org)
    return OrganizationResponse(id=org.id, name=org.name, created_at=org.created_at)
