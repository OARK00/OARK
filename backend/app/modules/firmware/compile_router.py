"""Verify: compile a product's firmware code on the compile service.

A compile takes about 20 seconds, too long to keep a web request open. So
POST starts a job and answers at once; the page then asks for the job every
few seconds until it is finished, the same pattern as device commands.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.models.compile_job import CompileJob
from app.models.user import User
from app.modules.firmware import compile_service
from app.modules.firmware.sketch import check_size
from app.modules.products.router import get_org_product

router = APIRouter(prefix="/products/{product_id}/compile", tags=["firmware"])
logger = logging.getLogger("oark.compile")

# A job still "running" after this long was lost (the server restarted in the
# middle of it). It no longer blocks the next compile and reads as failed.
LOST_AFTER = timedelta(minutes=10)

# Where background jobs get their database session. Tests point it at theirs.
new_session = SessionLocal


class CompileRequest(BaseModel):
    code: str
    board: Literal["esp32", "esp8266"] = "esp32"

    @field_validator("code")
    @classmethod
    def code_fits(cls, code: str) -> str:
        return check_size(code)


class CompileJobResponse(BaseModel):
    id: uuid.UUID
    board: str
    status: str
    output: str
    firmware_bytes: int | None
    created_at: datetime
    finished_at: datetime | None


def _is_lost(job: CompileJob, now: datetime) -> bool:
    return job.status == "running" and now - job.created_at > LOST_AFTER


def to_response(job: CompileJob) -> CompileJobResponse:
    lost = _is_lost(job, datetime.now(timezone.utc))
    return CompileJobResponse(
        id=job.id,
        board=job.board,
        status="failed" if lost else job.status,
        output="The compile was interrupted. Press Verify again." if lost else job.output,
        firmware_bytes=job.firmware_bytes,
        created_at=job.created_at,
        finished_at=job.finished_at,
    )


def refusal(compiles_last_hour: int, running_now: int, per_hour: int) -> str | None:
    """Why a company may not start another compile right now, or None if it may."""
    if running_now > 0:
        return "Only one compile at a time. Wait for the current one to finish."
    if compiles_last_hour >= per_hour:
        return f"You have reached the limit of {per_hour} compiles per hour. Try again later."
    return None


def run_job(job_id: uuid.UUID, code: str, board: str) -> None:
    """Runs after the POST has answered. Every way out leaves the job finished."""
    db = new_session()
    try:
        job = db.get(CompileJob, job_id)
        if job is None:
            return
        try:
            outcome = compile_service.compile_code(code, board)
            job.status = "succeeded" if outcome.ok else "failed"
            job.output = outcome.output
            job.firmware = outcome.firmware
            job.firmware_bytes = len(outcome.firmware) if outcome.firmware else None
            if outcome.ok:
                # Each firmware is about 1 MB. Only the newest good one per
                # product is needed (it is what gets uploaded to a board), so
                # the older ones are dropped. A failed compile drops nothing:
                # the last good firmware stays. firmware_bytes is kept as history.
                db.query(CompileJob).filter(
                    CompileJob.product_id == job.product_id,
                    CompileJob.id != job.id,
                    CompileJob.firmware.isnot(None),
                ).update({CompileJob.firmware: None}, synchronize_session=False)
        except compile_service.CompileServiceUnavailable as error:
            logger.warning("Compile job %s could not reach the compile service: %s", job_id, error)
            job.status = "failed"
            job.output = "The compiler could not be reached. Try again in a minute."
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


@router.post("", response_model=CompileJobResponse, status_code=status.HTTP_202_ACCEPTED)
def start_compile(
    product_id: uuid.UUID,
    payload: CompileRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_org_product(db, product_id, current_user)
    if not compile_service.is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Compiling on Oark isn't set up yet.")

    now = datetime.now(timezone.utc)
    recent = db.query(CompileJob).filter(CompileJob.org_id == current_user.org_id, CompileJob.created_at >= now - timedelta(hours=1))
    compiles_last_hour = recent.with_entities(func.count(CompileJob.id)).scalar() or 0
    running_now = sum(1 for job in recent.filter(CompileJob.status == "running").all() if not _is_lost(job, now))
    reason = refusal(compiles_last_hour, running_now, settings.compiles_per_hour)
    if reason:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=reason)

    job = CompileJob(org_id=current_user.org_id, product_id=product.id, board=payload.board, status="running", output="")
    db.add(job)
    db.commit()
    db.refresh(job)
    background.add_task(run_job, job.id, payload.code, payload.board)
    return to_response(job)


@router.get("/{job_id}", response_model=CompileJobResponse)
def get_compile(
    product_id: uuid.UUID,
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = get_org_product(db, product_id, current_user)
    job = db.query(CompileJob).filter(CompileJob.id == job_id, CompileJob.product_id == product.id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compile not found")
    return to_response(job)
