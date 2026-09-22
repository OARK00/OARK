import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.alert import AlertEvent, AlertRule
from app.models.device import Device
from app.models.product import Product
from app.models.user import User
from app.modules.alerts.schemas import (
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


def get_org_rule(db: Session, rule_id: uuid.UUID, user: User) -> AlertRule:
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id, AlertRule.org_id == user.org_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    return rule


def to_rule_response(rule: AlertRule, names: dict) -> AlertRuleResponse:
    return AlertRuleResponse(
        id=rule.id,
        name=rule.name,
        condition=rule.condition,
        device_id=rule.device_id,
        device_name=names.get(("device", rule.device_id)),
        product_id=rule.product_id,
        product_name=names.get(("product", rule.product_id)),
        data_key=rule.data_key,
        threshold=rule.threshold,
        for_minutes=rule.for_minutes,
        cooldown_minutes=rule.cooldown_minutes,
        enabled=rule.enabled,
        created_at=rule.created_at,
    )


def scope_names(db: Session, org_id) -> dict:
    names: dict = {}
    for device in db.query(Device.id, Device.name).filter(Device.org_id == org_id):
        names[("device", device.id)] = device.name
    for product in db.query(Product.id, Product.name).filter(Product.org_id == org_id):
        names[("product", product.id)] = product.name
    return names


@router.get("/rules", response_model=list[AlertRuleResponse])
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rules = (
        db.query(AlertRule)
        .filter(AlertRule.org_id == current_user.org_id)
        .order_by(AlertRule.created_at.desc(), AlertRule.id)
        .all()
    )
    names = scope_names(db, current_user.org_id)
    return [to_rule_response(rule, names) for rule in rules]


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # A rule pointed at another organisation's device would be a way to watch
    # their data, so the scope is verified rather than trusted.
    if payload.device_id:
        owns = (
            db.query(Device.id)
            .filter(Device.id == payload.device_id, Device.org_id == current_user.org_id)
            .first()
        )
        if not owns:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    if payload.product_id:
        owns = (
            db.query(Product.id)
            .filter(Product.id == payload.product_id, Product.org_id == current_user.org_id)
            .first()
        )
        if not owns:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    rule = AlertRule(org_id=current_user.org_id, **payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return to_rule_response(rule, scope_names(db, current_user.org_id))


@router.patch("/rules/{rule_id}", response_model=AlertRuleResponse)
def update_rule(
    rule_id: uuid.UUID,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = get_org_rule(db, rule_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return to_rule_response(rule, scope_names(db, current_user.org_id))


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    db.delete(get_org_rule(db, rule_id, current_user))
    db.commit()


@router.get("/events", response_model=list[AlertEventResponse])
def list_events(
    limit: int = Query(default=50, le=200),
    unacknowledged: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(AlertEvent, AlertRule.name, Device.name)
        .join(AlertRule, AlertRule.id == AlertEvent.rule_id)
        .join(Device, Device.id == AlertEvent.device_id)
        .filter(AlertEvent.org_id == current_user.org_id)
    )
    if unacknowledged:
        query = query.filter(AlertEvent.acknowledged_at.is_(None))

    rows = query.order_by(AlertEvent.triggered_at.desc()).limit(limit).all()
    return [
        AlertEventResponse(
            id=event.id,
            rule_id=event.rule_id,
            rule_name=rule_name,
            device_id=event.device_id,
            device_name=device_name,
            message=event.message,
            value=event.value,
            triggered_at=event.triggered_at,
            acknowledged_at=event.acknowledged_at,
        )
        for event, rule_name, device_name in rows
    ]


@router.post("/events/acknowledge", status_code=status.HTTP_204_NO_CONTENT)
def acknowledge_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Marks everything currently unacknowledged as seen. The events stay:
    what went wrong is history, not a notification to be cleared away."""
    db.query(AlertEvent).filter(
        AlertEvent.org_id == current_user.org_id, AlertEvent.acknowledged_at.is_(None)
    ).update({AlertEvent.acknowledged_at: datetime.now(timezone.utc)})
    db.commit()
