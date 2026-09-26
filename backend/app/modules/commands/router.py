import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.broker import BrokerError
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.command import DeviceCommand
from app.models.user import User
from app.modules.commands import engine
from app.modules.commands.schemas import CommandCreate, CommandResponse
from app.modules.devices.router import get_org_device

router = APIRouter(prefix="/devices/{device_id}/commands", tags=["commands"])
logger = logging.getLogger("oark.commands")

# Per device. Generous for a person at a switch, low enough that a stuck
# script cannot flood a device or the broker.
COMMANDS_PER_MINUTE = 30


def to_response(command: DeviceCommand, sent_by: str | None, now: datetime) -> CommandResponse:
    return CommandResponse(
        id=command.id,
        key=command.key,
        value=command.value,
        status=engine.display_status(command, now),
        sent_by=sent_by,
        created_at=command.created_at,
        expires_at=command.created_at + engine.COMMAND_TTL,
        delivered_at=command.delivered_at,
        resolved_at=command.resolved_at,
    )


@router.post("", response_model=CommandResponse, status_code=status.HTTP_201_CREATED)
def send_command(
    device_id: uuid.UUID,
    payload: CommandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = get_org_device(db, device_id, current_user)
    try:
        point = engine.writable_point(device, payload.key)
        value = engine.validate_value(point, payload.value)
    except engine.CommandRejected as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    now = datetime.now(timezone.utc)
    recent = (
        db.query(DeviceCommand)
        .filter(DeviceCommand.device_id == device.id, DeviceCommand.created_at > now - timedelta(minutes=1))
        .count()
    )
    if recent >= COMMANDS_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many commands to this device in the last minute. Wait a moment and try again.",
        )

    # A newer instruction for the same field replaces one still waiting, so
    # the device is never sent two different answers for one switch.
    db.query(DeviceCommand).filter(
        DeviceCommand.device_id == device.id,
        DeviceCommand.key == point.key,
        DeviceCommand.status == "pending",
    ).update({DeviceCommand.status: "superseded", DeviceCommand.resolved_at: now})

    command = DeviceCommand(
        org_id=device.org_id,
        device_id=device.id,
        key=point.key,
        value=value,
        status="pending",
        sent_by_user_id=current_user.id,
        created_at=now,
    )
    db.add(command)
    # Recorded before it is sent: a command the device acted on must never
    # be missing from the history because the send and the save disagreed.
    db.commit()

    try:
        engine.send_waiting(db, device.id, now)
    except BrokerError as error:
        # Still pending: the sweep sends it once the device is heard from.
        logger.warning("Sending a command to device %s failed: %s", device.id, error)
    db.commit()
    db.refresh(command)
    return to_response(command, current_user.email, now)


@router.get("", response_model=list[CommandResponse])
def list_commands(
    device_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = get_org_device(db, device_id, current_user)
    rows = (
        db.query(DeviceCommand, User.email)
        .outerjoin(User, User.id == DeviceCommand.sent_by_user_id)
        .filter(DeviceCommand.device_id == device.id)
        .order_by(DeviceCommand.created_at.desc(), DeviceCommand.id)
        .limit(limit)
        .all()
    )
    now = datetime.now(timezone.utc)
    return [to_response(command, email, now) for command, email in rows]
