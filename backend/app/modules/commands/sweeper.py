"""The timer that retries and expires commands.

Runs beside the MQTT listener, like the silence watcher: a device coming back
online produces no event to react to except its reports, and a command that
nobody confirmed has to be noticed by something that goes looking.
"""
import asyncio
import logging
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.modules.commands.engine import sweep

logger = logging.getLogger("oark.commands")

SWEEP_INTERVAL_SECONDS = 5


def sweep_once() -> None:
    db = SessionLocal()
    try:
        expired, resent = sweep(db, datetime.now(timezone.utc))
        db.commit()
        if expired or resent:
            logger.info("Commands: %d expired, resent to %d device(s)", expired, resent)
    except Exception:
        # A failed sweep must never end the loop: the next one tries again.
        logger.exception("Command sweep failed")
        db.rollback()
    finally:
        db.close()


async def sweep_commands():
    while True:
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
        # In a thread: resending calls the broker's HTTP API, which must not
        # hold up the event loop that is receiving device messages.
        await asyncio.to_thread(sweep_once)
