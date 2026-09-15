"""Device logins on the EMQX broker.

Each device connects with username = its device ID and password = its device
secret. The broker's access rules only let a username publish to
oark/devices/<username>/telemetry, so a leaked login can only ever speak as
that one device.
"""

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


def delete_device_login(device_id: str) -> None:
    try:
        with _client() as client:
            response = client.delete(f"{USERS_PATH}/{device_id}")
            # 404: the device never had a login (created before per-device logins).
            _check(response, (200, 204, 404))
    except httpx.HTTPError as exc:
        raise BrokerError(f"Broker API unreachable: {exc}") from exc
