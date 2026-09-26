"""Device logins on the EMQX broker, and messages sent to devices.

Each device connects with username = its device ID and password = its device
secret. The broker's access rules only let a username publish to
oark/devices/<username>/telemetry and subscribe to
oark/devices/<username>/commands, so a leaked login can only ever speak as,
and listen as, that one device.
"""

import json

import httpx

from app.core.config import settings

USERS_PATH = "/authentication/password_based:built_in_database/users"
TIMEOUT_SECONDS = 10


class BrokerError(Exception):
    """The broker could not be updated; the caller must not pretend it was."""


def _client() -> httpx.Client:
    if not (settings.emqx_api_url and settings.emqx_api_key and settings.emqx_api_secret):
        raise BrokerError("Broker API is not configured")
    return httpx.Client(
        base_url=settings.emqx_api_url,
        auth=(settings.emqx_api_key, settings.emqx_api_secret),
        timeout=TIMEOUT_SECONDS,
    )


def _check(response: httpx.Response, allowed: tuple[int, ...]) -> None:
    if response.status_code not in allowed:
        raise BrokerError(f"Broker API returned {response.status_code}: {response.text[:200]}")


def create_device_login(device_id: str, secret: str) -> None:
    try:
        with _client() as client:
            response = client.post(
                USERS_PATH, json={"user_id": device_id, "password": secret, "is_superuser": False}
            )
            _check(response, (200, 201))
    except httpx.HTTPError as exc:
        raise BrokerError(f"Broker API unreachable: {exc}") from exc


def replace_device_login(device_id: str, secret: str) -> None:
    """Set a new password, creating the login if the device never had one."""
    try:
        with _client() as client:
            response = client.put(f"{USERS_PATH}/{device_id}", json={"password": secret, "is_superuser": False})
            if response.status_code == 404:
                response = client.post(
                    USERS_PATH, json={"user_id": device_id, "password": secret, "is_superuser": False}
                )
            _check(response, (200, 201, 204))
    except httpx.HTTPError as exc:
        raise BrokerError(f"Broker API unreachable: {exc}") from exc


def commands_topic(device_id: str) -> str:
    return f"oark/devices/{device_id}/commands"


def publish_to_device(device_id: str, message: dict) -> bool:
    """Send a message to one device through the broker's HTTP API.

    Returns True when the broker handed it to the connected device, False
    when nothing was subscribed (the device is offline, or its firmware does
    not listen for commands). Not retained: an old instruction must never be
    waiting on the topic for a device that reconnects hours later.
    """
    try:
        with _client() as client:
            response = client.post(
                "/publish",
                json={
                    "topic": commands_topic(device_id),
                    "payload": json.dumps(message),
                    "qos": 1,
                    "retain": False,
                },
            )
            # 202 carries reason "no_matching_subscribers".
            _check(response, (200, 202))
            return response.status_code == 200
    except httpx.HTTPError as exc:
        raise BrokerError(f"Broker API unreachable: {exc}") from exc


def delete_device_login(device_id: str) -> None:
    try:
        with _client() as client:
            response = client.delete(f"{USERS_PATH}/{device_id}")
            # 404: the device never had a login (created before per-device logins).
            _check(response, (200, 204, 404))
    except httpx.HTTPError as exc:
        raise BrokerError(f"Broker API unreachable: {exc}") from exc
