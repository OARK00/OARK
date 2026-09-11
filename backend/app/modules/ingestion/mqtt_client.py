import asyncio
import json
import logging

import aiomqtt

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.ingestion.handler import handle_telemetry_message

logger = logging.getLogger("oark.ingestion")

# Devices publish to oark/devices/{device_id}/telemetry with a JSON body
# of {"secret": "<device secret>", "data": {...arbitrary reported state...}}.
TELEMETRY_TOPIC_FILTER = "oark/devices/+/telemetry"


async def _consume():
    async with aiomqtt.Client(
        hostname=settings.mqtt_host,
        port=settings.mqtt_port,
        username=settings.mqtt_username,
        password=settings.mqtt_password,
        tls_params=aiomqtt.TLSParameters(),
    ) as client:
        await client.subscribe(TELEMETRY_TOPIC_FILTER)
        logger.info("Connected to MQTT broker, subscribed to %s", TELEMETRY_TOPIC_FILTER)

        async for message in client.messages:
            topic_parts = message.topic.value.split("/")
            if len(topic_parts) != 4:
                continue
            device_id_str = topic_parts[2]

            try:
                payload = json.loads(message.payload)
            except (json.JSONDecodeError, TypeError):
                logger.warning("Dropped malformed payload on %s", message.topic.value)
                continue

            db = SessionLocal()
            try:
                accepted = handle_telemetry_message(db, device_id_str, payload)
                if not accepted:
                    logger.warning("Rejected telemetry for device %s", device_id_str)
            finally:
                db.close()


async def run_mqtt_forever():
    """Reconnect loop so a broker blip or free-tier hiccup doesn't kill ingestion for good."""
    while True:
        try:
            await _consume()
        except aiomqtt.MqttError as error:
            logger.warning("MQTT connection lost (%s); reconnecting in 5s", error)
            await asyncio.sleep(5)
