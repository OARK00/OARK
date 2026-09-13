import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.device import Device
from app.models.telemetry import TelemetryReading
from app.models.user import User
from app.modules.telemetry.schemas import TelemetryReadingResponse

router = APIRouter(prefix="/devices/{device_id}/telemetry", tags=["telemetry"])


@router.get("", response_model=list[TelemetryReadingResponse])
def get_device_telemetry(
    device_id: uuid.UUID,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id, Device.org_id == current_user.org_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    readings = (
        db.query(TelemetryReading)
        .filter(TelemetryReading.device_id == device.id)
        .order_by(TelemetryReading.recorded_at.desc())
        .limit(limit)
        .all()
    )

    return readings