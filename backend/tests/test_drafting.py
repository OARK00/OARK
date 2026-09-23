"""Drafting a product with AI. The model is faked: these tests are about what
Oark does with an answer -- good, bad, or missing -- not about the model."""
import pytest

from app.core.ai import AIUnavailable
from app.core.config import settings
from app.models.ai_request import AiRequest
from app.models.product import Product
from app.modules.products import drafting
from app.modules.products import router as products_router

GOOD_ANSWER = {
    "name": "Cold Store Monitor",
    "category": "sensor",
    "description": "Watches a freezer's temperature and door.",
    "data_points": [
        {"key": "temperature", "label": "Temperature", "type": "number", "unit": "°C", "access": "read"},
        {"key": "door_open", "label": "Door open", "type": "boolean", "unit": None, "access": "read"},
    ],
}


@pytest.fixture()
def ai(monkeypatch):
    """Configure AI and control what the 'model' answers."""
    state = {"answer": GOOD_ANSWER, "error": None, "calls": 0}

    def fake_generate(system_prompt, user_text, schema):
        state["calls"] += 1
        if state["error"]:
            raise state["error"]
        return state["answer"]

    monkeypatch.setattr(products_router, "is_configured", lambda: True)
    monkeypatch.setattr(drafting, "generate_json", fake_generate)
    return state


def draft(client, headers, text="A cold store freezer with a door sensor"):
    return client.post("/products/draft", json={"description": text}, headers=headers)


def usage(db_session, client, headers):
    """This account's AI usage only. Counting the whole table would make the
    tests depend on whatever else happens to be in the database."""
    org_id = client.get("/auth/me", headers=headers).json()["org_id"]
    return [row.succeeded for row in db_session.query(AiRequest).filter(AiRequest.org_id == org_id)]


def test_a_good_answer_becomes_a_draft(client, account, ai):
    response = draft(client, account()["headers"])

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Cold Store Monitor"
    assert [p["key"] for p in body["data_points"]] == ["temperature", "door_open"]


def test_a_draft_saves_nothing(client, account, ai, db_session):
    before = db_session.query(Product).count()

    draft(client, account()["headers"])

    assert db_session.query(Product).count() == before


def test_a_boolean_cannot_carry_a_unit(client, account, ai):
    """The same rule a hand-made product follows is applied to the model."""
    ai["answer"] = {
        **GOOD_ANSWER,
        "data_points": [{"key": "running", "label": "Running", "type": "boolean", "unit": "rpm", "access": "write"}],
    }

    point = draft(client, account()["headers"]).json()["data_points"][0]

    assert point["unit"] is None


@pytest.mark.parametrize(
    "bad_answer",
    [
        {**GOOD_ANSWER, "data_points": []},
        {**GOOD_ANSWER, "category": "toaster"},
        {**GOOD_ANSWER, "data_points": [GOOD_ANSWER["data_points"][0], GOOD_ANSWER["data_points"][0]]},
        {**GOOD_ANSWER, "data_points": [{"key": "x", "label": "X", "type": "number", "min": 10, "max": 1}]},
        {"name": "No points at all"},
    ],
)
def test_an_unusable_answer_is_refused_and_counted(client, account, ai, db_session, bad_answer):
    ai["answer"] = bad_answer
    headers = account()["headers"]

    response = draft(client, headers)

    assert response.status_code == 422
    assert usage(db_session, client, headers) == [False]


def test_without_a_key_nothing_is_called_or_counted(client, account, ai, monkeypatch, db_session):
    monkeypatch.setattr(products_router, "is_configured", lambda: False)
    headers = account()["headers"]

    response = draft(client, headers)

    assert response.status_code == 503
    assert ai["calls"] == 0
    assert usage(db_session, client, headers) == []


def test_a_provider_outage_is_reported_as_ours_not_theirs(client, account, ai, db_session):
    ai["error"] = AIUnavailable("AI provider returned 500")
    headers = account()["headers"]

    response = draft(client, headers)

    assert response.status_code == 503
    assert "template" in response.json()["detail"]
    assert usage(db_session, client, headers) == [False]


def test_the_hourly_limit_stops_one_account_using_all_the_quota(client, account, ai, monkeypatch):
    monkeypatch.setattr(settings, "ai_drafts_per_hour", 2)
    headers = account()["headers"]

    first, second, third = (draft(client, headers) for _ in range(3))

    assert (first.status_code, second.status_code) == (200, 200)
    assert third.status_code == 429
    assert ai["calls"] == 2  # the refused request never reached the model


def test_the_ui_can_ask_whether_drafting_is_available(client, account, monkeypatch):
    headers = account()["headers"]

    monkeypatch.setattr(products_router, "is_configured", lambda: False)
    off = client.get("/products/draft/status", headers=headers).json()
    monkeypatch.setattr(products_router, "is_configured", lambda: True)
    on = client.get("/products/draft/status", headers=headers).json()

    assert (off, on) == ({"available": False}, {"available": True})


def test_descriptions_are_bounded(client, account, ai):
    headers = account()["headers"]

    assert draft(client, headers, text="short").status_code == 422
    assert draft(client, headers, text="x" * 501).status_code == 422
    assert ai["calls"] == 0
