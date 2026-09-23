"""The provider call itself, with Google's side faked at the HTTP level."""
import json

import httpx
import pytest

from app.core import ai
from app.core.config import settings


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def answer(data: dict) -> FakeResponse:
    return FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(data)}]}}]})


@pytest.fixture()
def gemini(monkeypatch):
    """Queue the responses Google 'sends' and record what we sent."""
    state = {"responses": [], "calls": []}

    def fake_post(url, json=None, headers=None, timeout=None):
        state["calls"].append({"url": url, "headers": headers})
        return state["responses"].pop(0)

    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(settings, "gemini_model", "primary-model")
    monkeypatch.setattr(settings, "gemini_fallback_model", "backup-model")
    monkeypatch.setattr(ai.httpx, "post", fake_post)
    monkeypatch.setattr(ai.time, "sleep", lambda seconds: state.setdefault("slept", True))
    return state


def test_a_normal_answer_comes_back_as_a_dict(gemini):
    gemini["responses"] = [answer({"name": "Freezer"})]

    assert ai.generate_json("system", "text", {}) == {"name": "Freezer"}


def test_the_key_travels_in_a_header_never_in_the_url(gemini):
    gemini["responses"] = [answer({})]

    ai.generate_json("system", "text", {})

    call = gemini["calls"][0]
    assert call["headers"] == {"x-goog-api-key": "test-key"}
    assert "test-key" not in call["url"]


def test_high_demand_moves_to_the_fallback_model(gemini):
    """A busy model says nothing about the other one's capacity."""
    gemini["responses"] = [FakeResponse(503, {}), answer({"name": "Freezer"})]

    assert ai.generate_json("system", "text", {}) == {"name": "Freezer"}
    assert "primary-model" in gemini["calls"][0]["url"]
    assert "backup-model" in gemini["calls"][1]["url"]
    assert "slept" not in gemini  # a different model needs no pause


def test_a_primary_that_hangs_falls_back_too(gemini, monkeypatch):
    calls = []

    def slow_then_fine(url, json=None, headers=None, timeout=None):
        calls.append(url)
        if "primary-model" in url:
            raise httpx.ReadTimeout("took too long")
        return answer({"name": "Freezer"})

    monkeypatch.setattr(ai.httpx, "post", slow_then_fine)

    assert ai.generate_json("system", "text", {}) == {"name": "Freezer"}
    assert len(calls) == 2


def test_without_a_distinct_fallback_the_same_model_is_retried_after_a_pause(gemini, monkeypatch):
    monkeypatch.setattr(settings, "gemini_fallback_model", "primary-model")
    gemini["responses"] = [FakeResponse(503, {}), answer({"name": "Freezer"})]

    assert ai.generate_json("system", "text", {}) == {"name": "Freezer"}
    assert all("primary-model" in call["url"] for call in gemini["calls"])
    assert gemini.get("slept") is True


def test_it_gives_up_after_one_retry(gemini):
    gemini["responses"] = [FakeResponse(503, {}), FakeResponse(503, {})]

    with pytest.raises(ai.AIUnavailable):
        ai.generate_json("system", "text", {})
    assert len(gemini["calls"]) == 2


def test_quota_errors_are_not_retried(gemini):
    """Retrying a spent quota only spends more of it."""
    gemini["responses"] = [FakeResponse(429, {})]

    with pytest.raises(ai.AIUnavailable):
        ai.generate_json("system", "text", {})
    assert len(gemini["calls"]) == 1


def test_a_retired_model_fails_clearly(gemini):
    gemini["responses"] = [FakeResponse(404, {"error": {"message": "no longer available"}})]

    with pytest.raises(ai.AIUnavailable):
        ai.generate_json("system", "text", {})


def test_an_unreachable_provider_is_reported_not_crashed(gemini, monkeypatch):
    def refuse(*args, **kwargs):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(ai.httpx, "post", refuse)

    with pytest.raises(ai.AIUnavailable):
        ai.generate_json("system", "text", {})


def test_text_that_is_not_json_is_refused(gemini):
    gemini["responses"] = [
        FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": "Sure! Here's a product:"}]}}]})
    ]

    with pytest.raises(ai.AIUnavailable):
        ai.generate_json("system", "text", {})


def test_without_a_key_nothing_is_sent(gemini, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")

    with pytest.raises(ai.AIUnavailable):
        ai.generate_json("system", "text", {})
    assert gemini["calls"] == []
