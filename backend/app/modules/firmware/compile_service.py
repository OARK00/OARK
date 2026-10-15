"""Calling the compile service on Google Cloud Run.

The service only lets in callers with a Google identity that is allowed to
use it. Oark's identity is a robot account whose key is in the
COMPILE_SERVICE_CREDENTIALS setting; from it we get a short-lived token
(about an hour) and send it with each request.
"""
import base64
import json
import threading
from dataclasses import dataclass

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from app.core.config import settings

# A compile takes about 20 s once the service is awake, plus up to ~30 s to
# wake it. The service itself stops a compile after 240 s.
REQUEST_TIMEOUT_SECONDS = 300


class CompileServiceUnavailable(Exception):
    """The service could not be asked, or did not answer properly. The
    message is for the logs; the person sees a general sentence."""


@dataclass
class CompileOutcome:
    ok: bool
    output: str
    firmware: bytes | None = None


def is_configured() -> bool:
    return bool(settings.compile_service_url and settings.compile_service_credentials)


_credentials: service_account.IDTokenCredentials | None = None
_credentials_lock = threading.Lock()


def _token() -> str:
    """A token that says "this is Oark", made for the compile service only.
    Reused until it is about to expire."""
    global _credentials
    with _credentials_lock:
        if _credentials is None:
            try:
                info = json.loads(settings.compile_service_credentials)
                _credentials = service_account.IDTokenCredentials.from_service_account_info(
                    info, target_audience=settings.compile_service_url
                )
            except (ValueError, KeyError) as error:
                raise CompileServiceUnavailable(f"COMPILE_SERVICE_CREDENTIALS is not a usable key: {type(error).__name__}")
        if not _credentials.valid:
            try:
                _credentials.refresh(Request())
            except Exception as error:  # noqa: BLE001 -- any failure here means "cannot sign in"
                raise CompileServiceUnavailable(f"Could not get a token: {type(error).__name__}")
        return str(_credentials.token)


def compile_code(code: str, board: str) -> CompileOutcome:
    url = settings.compile_service_url.rstrip("/") + "/compile"
    try:
        response = httpx.post(
            url,
            json={"code": code, "board": board},
            headers={"Authorization": f"Bearer {_token()}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        raise CompileServiceUnavailable(f"Request failed: {type(error).__name__}")

    if response.status_code == 422:
        # The service refused the sketch itself (size, board); its reason is
        # meant for the person.
        return CompileOutcome(ok=False, output=str(response.json().get("detail", "The code was refused.")))
    if response.status_code != 200:
        raise CompileServiceUnavailable(f"Compile service answered {response.status_code}")

    body = response.json()
    firmware = base64.b64decode(body["firmware"]) if body.get("ok") and body.get("firmware") else None
    return CompileOutcome(ok=bool(body.get("ok")) and firmware is not None, output=str(body.get("output", "")), firmware=firmware)
