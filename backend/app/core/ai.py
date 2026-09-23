"""Talking to an AI model, and nothing else.

Callers ask for JSON matching a schema and get a dict back. Which company
answers is a setting: moving from Gemini to Claude means adding one function
here and changing AI_PROVIDER, with no change to anything that calls this.
"""
import json
import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger("oark.ai")

TIMEOUT_SECONDS = 20

# "High demand", internal errors and timeouts are about one model's capacity
# at one moment, so the next attempt goes to the fallback model, which has
# capacity of its own. 429 (quota) and 4xx are not retried: a spent quota
# will not be back in two seconds, and a bad request stays bad.
RETRY_STATUSES = {500, 503}
RETRY_DELAY_SECONDS = 1.5


class AIUnavailable(Exception):
    """The provider is not configured, unreachable, or refused the request.
    Not the user's fault, so the message shown to them says so."""


def is_configured() -> bool:
    if settings.ai_provider == "gemini":
        return bool(settings.gemini_api_key)
    return False


def generate_json(system_prompt: str, user_text: str, schema: dict) -> dict:
    if settings.ai_provider == "gemini":
        return _gemini(system_prompt, user_text, schema)
    raise AIUnavailable(f"Unknown AI provider: {settings.ai_provider}")


def _gemini_attempts() -> list[str]:
    """Primary, then fallback. With no distinct fallback, the primary gets a
    second try after a short pause instead."""
    primary = settings.gemini_model
    fallback = settings.gemini_fallback_model
    if fallback and fallback != primary:
        return [primary, fallback]
    return [primary, primary]


def _gemini(system_prompt: str, user_text: str, schema: dict) -> dict:
    if not settings.gemini_api_key:
        raise AIUnavailable("AI drafting is not configured")

    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            # Constrained output: the model must answer in this JSON shape,
            # which removes most of the "almost JSON" failures.
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.2,
        },
    }

    attempts = _gemini_attempts()
    last_reason = "no attempt made"
    for number, model in enumerate(attempts):
        if number > 0 and model == attempts[number - 1]:
            time.sleep(RETRY_DELAY_SECONDS)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            response = httpx.post(
                url,
                json=body,
                # In a header, not the URL, so the key never lands in access logs.
                headers={"x-goog-api-key": settings.gemini_api_key},
                timeout=TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException:
            last_reason = f"{model} timed out"
            logger.info("AI attempt failed, %s", last_reason)
            continue
        except httpx.HTTPError as exc:
            raise AIUnavailable(f"AI provider unreachable: {type(exc).__name__}") from exc

        if response.status_code in RETRY_STATUSES:
            last_reason = f"{model} returned {response.status_code}"
            logger.info("AI attempt failed, %s", last_reason)
            continue

        if response.status_code != 200:
            # Google's message says which it is -- retired model, spent
            # quota -- and never contains the key.
            try:
                reason = str(response.json().get("error", {}).get("message", ""))[:200]
            except ValueError:
                reason = ""
            raise AIUnavailable(f"{model} returned {response.status_code}: {reason}")

        return _read_answer(response)

    raise AIUnavailable(f"All attempts failed; last: {last_reason}")


def _read_answer(response: httpx.Response) -> dict:
    try:
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise AIUnavailable("AI provider returned an unreadable answer") from exc

    if not isinstance(result, dict):
        raise AIUnavailable("AI provider returned an unreadable answer")
    return result
