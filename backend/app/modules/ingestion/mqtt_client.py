import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import aiomqtt

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.ingestion.handler import handle_telemetry_message
from app.modules.ingestion.state import ingestion_state

logger = logging.getLogger("oark.ingestion")

# Devices publish to oark/devices/{device_id}/telemetry with a JSON body
# of {"secret": "<device secret>", "data": {...arbitrary reported state...}}.
TELEMETRY_TOPIC_FILTER = "oark/devices/+/telemetry"


def share_group() -> str:
    """The shared-subscription group this listener joins.

    Every listener in a group gets a *share* of the messages, not a copy, so
    running two of them doubles the capacity instead of doubling the rows.
    The group is per environment: a developer's laptop must never take
    production's messages away from production.
    """
    return f"oark-ingest-{settings.app_env}"


def subscription_filter() -> str:
    return f"$share/{share_group()}/{TELEMETRY_TOPIC_FILTER}"


def client_identifier() -> str:
    """Unique per process: two clients sharing an id kick each other off."""
    return f"oark-listener-{settings.app_env}-{uuid.uuid4().hex[:8]}"


async def _consume():
    async with aiomqtt.Client(
        hostname=settings.mqtt_host,
        port=settings.mqtt_port,
        username=settings.mqtt_username,
        password=settings.mqtt_password,
        identifier=client_identifier(),
        tls_params=aiomqtt.TLSParameters(),
    ) as client:
        # QoS 1: the broker keeps redelivering until this listener confirms,
        # so a message isn't lost in the gap between arriving and being saved.
        await client.subscribe(subscription_filter(), qos=1)
        logger.info("Connected to MQTT broker, subscribed to %s", subscription_filter())
        ingestion_state.mark_connected()

        async for message in client.messages:
            ingestion_state.last_message_at = datetime.now(timezone.utc)
            topic_parts = message.topic.value.split("/")
            if len(topic_parts) != 4:
                continue
            device_id_str = topic_parts[2]

            try:
                if not isinstance(message.payload, (str, bytes, bytearray)):
                    raise TypeError("payload is not text")
                payload = json.loads(message.payload)
            except (json.JSONDecodeError, TypeError):
                logger.warning("Dropped malformed payload on %s", message.topic.value)
                continue

            db = SessionLocal()
            try:
                accepted = handle_telemetry_message(db, device_id_str, payload)
                if not accepted:
                    logger.warning("Rejected telemetry for device %s", device_id_str)
            except Exception:
                # One message that fails to save must not disconnect every
                # device: log it, drop it, keep listening.
                db.rollback()
                logger.exception("Failed to store telemetry for device %s", device_id_str)
            finally:
                db.close()


async def run_mqtt_forever():
    """Reconnect loop so a broker blip or free-tier hiccup doesn't kill ingestion for good."""
    while True:
        try:
            await _consume()
        except aiomqtt.MqttError as error:
            logger.warning("MQTT connection lost (%s); reconnecting in 5s", error)
            ingestion_state.mark_disconnected(str(error))
            await asyncio.sleep(5)
        except Exception as error:
            logger.exception("Unexpected error in MQTT ingestion loop; reconnecting in 5s")
            ingestion_state.mark_disconnected(f"{type(error).__name__}: {error}")
            await asyncio.sleep(5)
