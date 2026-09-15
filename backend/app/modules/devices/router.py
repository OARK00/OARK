import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import generate_device_secret, hash_password
from app.models.device import Device, compute_status
from app.models.product import Product
from app.models.user import User
from app.modules.devices.schemas import DeviceCreate, DeviceCreateResponse, DeviceResponse

router = APIRouter(prefix="/devices", tags=["devices"])


def to_response(device: Device) -> DeviceResponse:
    return DeviceResponse(
        id=device.id,
        name=device.name,
        product_id=device.product_id,
        product_name=device.product.name if device.product else None,
        category=device.category,
        description=device.description,
        model_number=device.model_number,
        firmware_version=device.firmware_version,
        is_controllable=device.is_controllable,
        status=compute_status(device.last_seen_at).value,
        last_seen_at=device.last_seen_at,
        reported_state=device.reported_state,
    )


@router.get("", response_model=list[DeviceResponse])
def list_devices(
    product_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Device).options(joinedload(Device.product)).filter(Device.org_id == current_user.org_id)
    if product_id:
        query = query.filter(Device.product_id == product_id)
    devices = query.order_by(Device.created_at, Device.id).all()
    return [to_response(d) for d in devices]


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(device_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id, Device.org_id == current_user.org_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return to_response(device)


@router.post("", response_model=DeviceCreateResponse, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    category = payload.category
    if payload.product_id:
        product = (
            db.query(Product)
            .filter(Product.id == payload.product_id, Product.org_id == current_user.org_id)
            .first()
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        category = product.category

    secret = generate_device_secret()
    device = Device(
        org_id=current_user.org_id,
        product_id=payload.product_id,
        name=payload.name,
        category=category,
        description=payload.description,
        model_number=payload.model_number,
        firmware_version=payload.firmware_version,
        is_controllable=payload.is_controllable,
        hashed_secret=hash_password(secret),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceCreateResponse(
        id=device.id,
        name=device.name,
        product_id=device.product_id,
        category=device.category,
        description=device.description,
        model_number=device.model_number,
        firmware_version=device.firmware_version,
        secret=secret,
    )


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = db.query(Device).filter(Device.id == device_id, Device.org_id == current_user.org_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    db.delete(device)
    db.commit()
