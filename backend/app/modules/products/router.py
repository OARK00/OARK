import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.device import Device
from app.models.product import Product
from app.models.telemetry import TelemetryReading
from app.models.user import User
from app.modules.products.inference import suggest_data_points
from app.modules.products.schemas import (
    DataPointsUpdate,
    ProductCreate,
    ProductResponse,
    SuggestionsResponse,
)

router = APIRouter(prefix="/products", tags=["products"])

# Enough recent history to see every field a device sends, without scanning
# a product's whole telemetry table.
SUGGESTION_READING_LIMIT = 200


def get_org_product(db: Session, product_id: uuid.UUID, user: User) -> Product:
    product = db.query(Product).filter(Product.id == product_id, Product.org_id == user.org_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def count_devices(db: Session, product_id: uuid.UUID) -> int:
    return db.query(func.count(Device.id)).filter(Device.product_id == product_id).scalar() or 0


def to_response(product: Product, device_count: int) -> ProductResponse:
    return ProductResponse(
        id=product.id,
        name=product.name,
        category=product.category,
        description=product.description,
        model_number=product.model_number,
        data_points=product.data_points,
        device_count=device_count,
        created_at=product.created_at,
    )


@router.get("", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    products = (
        db.query(Product)
        .filter(Product.org_id == current_user.org_id)
        .order_by(Product.created_at, Product.id)
        .all()
    )
    rows = (
        db.query(Device.product_id, func.count(Device.id))
        .filter(Device.org_id == current_user.org_id, Device.product_id.isnot(None))
        .group_by(Device.product_id)
        .all()
    )
    counts: dict[uuid.UUID, int] = {row[0]: row[1] for row in rows}
    return [to_response(p, counts.get(p.id, 0)) for p in products]


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = Product(
        org_id=current_user.org_id,
        name=payload.name.strip(),
        category=payload.category,
        description=payload.description,
        model_number=payload.model_number,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return to_response(product, 0)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = get_org_product(db, product_id, current_user)
    return to_response(product, count_devices(db, product.id))


@router.put("/{product_id}/data-points", response_model=ProductResponse)
def update_data_points(
    product_id: uuid.UUID,
    payload: DataPointsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_org_product(db, product_id, current_user)
    product.data_points = [point.model_dump() for point in payload.data_points]
    db.commit()
    db.refresh(product)
    return to_response(product, count_devices(db, product.id))


@router.get("/{product_id}/suggested-data-points", response_model=SuggestionsResponse)
def suggested_data_points(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_org_product(db, product_id, current_user)
    readings = (
        db.query(TelemetryReading.data)
        .join(Device, Device.id == TelemetryReading.device_id)
        .filter(Device.product_id == product.id, TelemetryReading.org_id == current_user.org_id)
        .order_by(TelemetryReading.recorded_at.desc())
        .limit(SUGGESTION_READING_LIMIT)
        .all()
    )
    return SuggestionsResponse(
        reading_count=len(readings),
        device_count=count_devices(db, product.id),
        data_points=suggest_data_points([r.data for r in readings], product.data_points),
    )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = get_org_product(db, product_id, current_user)
    device_count = count_devices(db, product.id)
    if device_count:
        noun = "device" if device_count == 1 else "devices"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Delete this product's {device_count} {noun} first.",
        )
    db.delete(product)
    db.commit()
