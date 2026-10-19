import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.broker import BrokerError, create_device_login, delete_device_login, replace_device_login
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.names import clean_name, ensure_name_is_free, is_name_conflict, name_taken
from app.core.security import generate_device_secret, hash_device_secret
from app.models.device import Device, compute_status
from app.models.product import Product
from app.models.user import User
from app.modules.devices.schemas import DeviceCreate, DeviceCreateResponse, DeviceResponse
from app.modules.products.test_product import get_or_create_test_product

router = APIRouter(prefix="/devices", tags=["devices"])

BROKER_UNAVAILABLE = "Could not update the device's broker login. Nothing was changed; try again."


def get_org_device(db: Session, device_id: uuid.UUID, user: User) -> Device:
    device = db.query(Device).filter(Device.id == device_id, Device.org_id == user.org_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


def to_create_response(device: Device, secret: str) -> DeviceCreateResponse:
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
    return to_response(get_org_device(db, device_id, current_user))


@router.post("", response_model=DeviceCreateResponse, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Before anything is created: a refused name must leave nothing behind
    # (no broker login, and no "Test devices" product made for nothing).
    ensure_name_is_free(db, Device, current_user.org_id, payload.name, "device")

    if payload.product_id:
        product = (
            db.query(Product)
            .filter(Product.id == payload.product_id, Product.org_id == current_user.org_id)
            .first()
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        category = product.category
    else:
        # "Test device": every device belongs to a product, so one made
        # without a product goes into the company's "Test devices" product.
        # It keeps the category it was given, for its icon.
        product = get_or_create_test_product(db, current_user.org_id)
        category = payload.category or product.category

    secret = generate_device_secret()
    device_name = clean_name(payload.name)
    device = Device(
        org_id=current_user.org_id,
        product_id=product.id,
        name=device_name,
        category=category,
        description=payload.description,
        model_number=payload.model_number,
        firmware_version=payload.firmware_version,
        is_controllable=payload.is_controllable,
        hashed_secret=hash_device_secret(secret),
    )
    db.add(device)
    # The check above runs first, but two requests at the same moment can
    # both pass it. The database's unique index refuses the second one right
    # here, before a broker login exists, so there is nothing to clean up.
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        if is_name_conflict(error):
            raise name_taken("device", device_name)
        raise

    # A device row without a broker login could never connect, so both
    # succeed together or neither is kept.
    try:
        create_device_login(str(device.id), secret)
    except BrokerError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=BROKER_UNAVAILABLE)

    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_device_login(str(device.id))
        except BrokerError:
            pass
        raise

    db.refresh(device)
    return to_create_response(device, secret)


@router.post("/{device_id}/credentials", response_model=DeviceCreateResponse)
def reset_credentials(device_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Issue a new secret. The old one stops working on the broker immediately."""
    device = get_org_device(db, device_id, current_user)
    secret = generate_device_secret()
    try:
        replace_device_login(str(device.id), secret)
    except BrokerError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=BROKER_UNAVAILABLE)
    device.hashed_secret = hash_device_secret(secret)
    db.commit()
    db.refresh(device)
    return to_create_response(device, secret)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = get_org_device(db, device_id, current_user)
    # Remove the broker login first: if that fails, keep the device, so a
    # login that can still connect never outlives the device it belongs to.
    try:
        delete_device_login(str(device.id))
    except BrokerError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=BROKER_UNAVAILABLE)
    db.delete(device)
    db.commit()
