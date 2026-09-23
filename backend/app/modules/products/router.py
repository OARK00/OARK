import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.ai import AIUnavailable, is_configured
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.ai_request import AiRequest
from app.models.device import Device
from app.models.product import Product
from app.models.telemetry import TelemetryReading
from app.models.user import User
from app.modules.products import drafting
from app.modules.products.inference import suggest_data_points
from app.modules.products.schemas import (
    DataPointsUpdate,
    ProductCreate,
    ProductResponse,
    SuggestionsResponse,
)

router = APIRouter(prefix="/products", tags=["products"])
logger = logging.getLogger("oark.ai")


class DraftRequest(BaseModel):
    # Long enough to describe a device, short enough to bound the cost of
    # every call and the room a hostile text has to work with.
    description: str = Field(min_length=8, max_length=500)


def _drafts_last_hour(db: Session, org_id) -> int:
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    return (
        db.query(func.count(AiRequest.id))
        .filter(AiRequest.org_id == org_id, AiRequest.created_at >= since)
        .scalar()
        or 0
    )


@router.get("/draft/status")
def draft_status(current_user: User = Depends(get_current_user)):
    """Lets the UI show the describe box as available or as coming soon,
    instead of offering a button that can only fail."""
    return {"available": is_configured()}


@router.post("/draft", response_model=drafting.ProductDraft)
def draft_product(
    payload: DraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Propose a product from one sentence. Saves nothing: the caller shows
    the draft for review and creates the product through the normal calls."""
    # Checked before the limit: a platform without a key costs nothing per
    # click, so those clicks must not use up anyone's hourly allowance.
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI drafting isn't set up yet. Start from a template or set it up yourself.",
        )
    if _drafts_last_hour(db, current_user.org_id) >= settings.ai_drafts_per_hour:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You've used this hour's AI drafts. Try again later, or start from a template.",
        )

    try:
        draft = drafting.draft_product(payload.description.strip())
    except AIUnavailable as exc:
        # The user gets a generic message; the reason goes to the logs, where
        # it is needed to tell a retired model from a spent quota.
        logger.warning("AI draft failed for org %s: %s", current_user.org_id, exc)
        db.add(AiRequest(org_id=current_user.org_id, succeeded=False))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI drafting isn't available right now. Start from a template or set it up yourself.",
        )
    except drafting.DraftRejected as exc:
        logger.warning("AI draft rejected for org %s: %s", current_user.org_id, str(exc)[:300])
        db.add(AiRequest(org_id=current_user.org_id, succeeded=False))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Couldn't turn that into a product. Try describing what the device measures.",
        )

    db.add(AiRequest(org_id=current_user.org_id, succeeded=True))
    db.commit()
    return draft

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
