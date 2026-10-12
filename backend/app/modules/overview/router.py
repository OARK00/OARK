"""The home page's data, in one request.

Everything here is derived, never stored: counts come from the devices
themselves and the message chart from telemetry_readings. Nothing has to be
kept up to date by a background job, so the page cannot show a number that
disagrees with the rest of the app.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.device import Device, compute_status
from app.models.product import Product
from app.models.telemetry import TelemetryReading
from app.models.user import User

router = APIRouter(prefix="/overview", tags=["overview"])

CHART_HOURS = 24
RECENT_DEVICE_LIMIT = 6
RECENT_PRODUCT_LIMIT = 6


def _message_counts(db: Session, org_id, since: datetime) -> dict:
    """Messages in the 24 hours from `since`, in the 24 hours before that,
    and per hour -- from one pass over the readings.

    These were three queries over the same rows. The telemetry table is the
    one that grows without limit, and this page reloads every 30 seconds, so
    it is read once here and served by the (org_id, recorded_at) index.

    The series has one bucket per hour including the empty ones: a chart that
    silently skips quiet hours draws a busier system than the real one.
    """
    recent = TelemetryReading.recorded_at >= since
    rows = db.execute(
        select(
            func.date_trunc("hour", TelemetryReading.recorded_at).label("hour"),
            func.count(TelemetryReading.id).filter(recent),
            func.count(TelemetryReading.id).filter(~recent),
        )
        .where(
            TelemetryReading.org_id == org_id,
            TelemetryReading.recorded_at >= since - timedelta(hours=CHART_HOURS),
        )
        .group_by("hour")
    ).all()
    per_hour = {row[0].replace(minute=0, second=0, microsecond=0): row[1] for row in rows}

    start = since.replace(minute=0, second=0, microsecond=0)
    return {
        "last_24h": sum(row[1] for row in rows),
        "previous_24h": sum(row[2] for row in rows),
        "series": [
            {
                "hour": (start + timedelta(hours=offset)).isoformat(),
                "count": per_hour.get(start + timedelta(hours=offset), 0),
            }
            for offset in range(CHART_HOURS + 1)
        ],
    }


@router.get("")
def overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = current_user.org_id
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=CHART_HOURS)

    devices = db.query(Device).filter(Device.org_id == org_id).all()
    statuses = [compute_status(device.last_seen_at).value for device in devices]

    products = (
        db.query(Product)
        .filter(Product.org_id == org_id)
        .order_by(Product.created_at.desc(), Product.id)
        .limit(RECENT_PRODUCT_LIMIT)
        .all()
    )
    product_count = db.execute(select(func.count(Product.id)).where(Product.org_id == org_id)).scalar() or 0
    # Counted from the devices already loaded rather than another query.
    devices_per_product: dict = {}
    for device in devices:
        if device.product_id:
            devices_per_product[device.product_id] = devices_per_product.get(device.product_id, 0) + 1

    recent = sorted(
        (d for d in devices if d.last_seen_at),
        key=lambda d: d.last_seen_at,  # type: ignore[arg-type,return-value]
        reverse=True,
    )[:RECENT_DEVICE_LIMIT]

    return {
        "devices": {
            "total": len(devices),
            "online": statuses.count("online"),
            "stale": statuses.count("stale"),
            "offline": statuses.count("offline"),
        },
        "products": product_count,
        "messages": _message_counts(db, org_id, day_ago),
        # The same three steps as the Connect wizard, answered from real data
        # so the checklist can never claim something the platform can't see.
        "checklist": {
            "product_created": product_count > 0,
            "device_added": len(devices) > 0,
            "first_message": any(d.last_seen_at for d in devices),
        },
        "recent_devices": [
            {
                "id": str(device.id),
                "name": device.name,
                "status": compute_status(device.last_seen_at).value,
                "last_seen_at": device.last_seen_at,
                "reported_state": device.reported_state,
            }
            for device in recent
        ],
        "recent_products": [
            {
                "id": str(product.id),
                "name": product.name,
                "category": product.category,
                "data_points": len(product.data_points or []),
                "device_count": devices_per_product.get(product.id, 0),
            }
            for product in products
        ],
        "never_reported": sum(1 for device in devices if device.last_seen_at is None),
    }
