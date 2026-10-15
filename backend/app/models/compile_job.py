import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CompileJob(Base):
    """One press of Verify: the code is compiled by the compile service in the
    background, and the page asks for this row until it is finished.

    The code itself is not kept: only what the compiler said and, when it
    worked, the firmware it made (for uploading to a board later)."""

    __tablename__ = "compile_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    board: Mapped[str] = mapped_column(String, nullable=False)
    # running -> succeeded | failed
    status: Mapped[str] = mapped_column(String, nullable=False, default="running")
    output: Mapped[str] = mapped_column(Text, nullable=False, default="")
    firmware: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    firmware_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
