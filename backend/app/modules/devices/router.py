import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import generate_device_secret, hash_password
from app.models.device import Device, compute_status
from app.models.user import User
from app.modules.devices.schemas import DeviceCreate, DeviceCreateResponse, DeviceResponse

router = APIRouter(prefix="/devices", tags=["devices"])


def to_response(device: Device) -> DeviceResponse:
    return DeviceResponse(
        id=device.id,
        name=device.name,
        is_controllable=device.is_controllable,
        status=compute_status(device.last_seen_at).value,
        last_seen_at=device.last_seen_at,
        reported_state=device.reported_state,
    )


@router.get("", response_model=list[DeviceResponse])
def list_devices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    devices = db.query(Device).filter(Device.org_id == current_user.org_id).all()
    return [to_response(d) for d in devices]


@router.post("", response_model=DeviceCreateResponse, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    secret = generate_device_secret()
    device = Device(
        org_id=current_user.org_id,
        name=payload.name,
        is_controllable=payload.is_controllable,
        hashed_secret=hash_password(secret),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceCreateResponse(id=device.id, name=device.name, secret=secret)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id, Device.org_id == current_user.org_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    db.delete(device)
    db.commit()
