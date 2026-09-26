import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine
from app.core.environment import assert_database_matches
from app.core.health import health_report
from app.modules.alerts.router import router as alerts_router
from app.modules.alerts.watcher import watch_for_silence
from app.modules.auth.router import router as auth_router
from app.modules.commands.router import router as commands_router
from app.modules.commands.sweeper import sweep_commands
from app.modules.devices.router import router as devices_router
from app.modules.overview.router import router as overview_router
from app.modules.products.router import router as products_router
from app.modules.telemetry.router import router as telemetry_router
from app.modules.ingestion.mqtt_client import run_mqtt_forever

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Before serving or ingesting anything: refuse to start against a
    # database that belongs to a different environment.
    with engine.connect() as conn:
        assert_database_matches(conn)

    if not settings.ingestion_in_api:
        yield
        return

    mqtt_task = asyncio.create_task(run_mqtt_forever())
    silence_task = asyncio.create_task(watch_for_silence())
    commands_task = asyncio.create_task(sweep_commands())
    yield
    mqtt_task.cancel()
    silence_task.cancel()
    commands_task.cancel()


app = FastAPI(title="Oark IoT Platform API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://app.oark.in",
        "https://oark-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(devices_router)
app.include_router(commands_router)
app.include_router(products_router)
app.include_router(overview_router)
app.include_router(alerts_router)
app.include_router(telemetry_router)


@app.get("/health")
def health():
    report, status_code = health_report(include_ingestion=settings.ingestion_in_api)
    return JSONResponse(jsonable_encoder(report), status_code=status_code)
