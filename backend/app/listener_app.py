"""The ingestion listener as its own service.

Same code as the listener the API runs today, but in a process of its own, so
deploying or restarting the web API cannot interrupt device data. It serves
one endpoint, /health, for two reasons: an uptime monitor can watch ingestion
directly, and Render's free plan only runs services that listen on a port.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core.database import engine
from app.core.environment import assert_database_matches
from app.core.health import health_report
from app.modules.alerts.watcher import watch_for_silence
from app.modules.commands.sweeper import sweep_commands
from app.modules.ingestion.mqtt_client import run_mqtt_forever

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    with engine.connect() as conn:
        assert_database_matches(conn)
    mqtt_task = asyncio.create_task(run_mqtt_forever())
    silence_task = asyncio.create_task(watch_for_silence())
    commands_task = asyncio.create_task(sweep_commands())
    yield
    mqtt_task.cancel()
    silence_task.cancel()
    commands_task.cancel()


app = FastAPI(title="Oark ingestion listener", lifespan=lifespan)


@app.get("/health")
def health():
    report, status_code = health_report(include_ingestion=True)
    return JSONResponse(jsonable_encoder(report), status_code=status_code)
