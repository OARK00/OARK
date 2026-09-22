"""The timer that notices silence.

Runs beside the MQTT listener, because it belongs to ingestion: a device that
stopped reporting produces no message to react to, so something has to go
looking. Only the process that runs ingestion runs this, which also keeps two
copies from firing the same alert twice.
"""
import asyncio
import logging

from app.core.database import SessionLocal
from app.modules.alerts.engine import check_silent_devices

logger = logging.getLogger("oark.alerts")

CHECK_INTERVAL_SECONDS = 60


async def watch_for_silence():
    while True:
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
        db = SessionLocal()
        try:
            fired = check_silent_devices(db)
            if fired:
                db.commit()
                logger.info("Recorded %d no-data alert(s)", len(fired))
        except Exception:
            # A failed check must never end the loop: the next minute tries again.
            logger.exception("Silence check failed")
            db.rollback()
        finally:
            db.close()
