"""Verify: compiling through the compile service, with a pretend service.

The risks: one company seeing or using another's compiles, a company using
up everyone's free allowance, a broken service leaving a job stuck forever,
and secrets or keys reaching the page.
"""
import base64
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.models.compile_job import CompileJob
from app.modules.firmware import compile_router, compile_service

CODE = "void setup() {}\nvoid loop() {}\n"
FIRMWARE = b"\xe9\x03firmware-bytes"


class PretendService:
    def __init__(self):
        self.calls = []
        self.answer = compile_service.CompileOutcome(ok=True, output="Sketch uses 1024 bytes (1%).", firmware=FIRMWARE)
        self.unavailable = False

    def __call__(self, code, board):
        self.calls.append((code, board))
        if self.unavailable:
            raise compile_service.CompileServiceUnavailable("pretend outage")
        return self.answer


@pytest.fixture()
def service(monkeypatch, db_session):
    pretend = PretendService()
    monkeypatch.setattr(compile_service, "compile_code", pretend)
    monkeypatch.setattr(compile_service, "is_configured", lambda: True)
    # The background job uses the test's database session, so its writes are
    # rolled back with everything else.
    monkeypatch.setattr(compile_router, "new_session", lambda: db_session)
    return pretend


def create_product(client, headers, name="Helmet"):
    response = client.post("/products", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def start(client, headers, product, code=CODE, board="esp32"):
    return client.post(f"/products/{product}/compile", json={"code": code, "board": board}, headers=headers)


def test_a_good_sketch_compiles_and_reports_its_size(client, account, service):
    headers = account()["headers"]
    product = create_product(client, headers)

    started = start(client, headers, product)
    job = client.get(f"/products/{product}/compile/{started.json()['id']}", headers=headers).json()

    assert started.status_code == 202
    assert started.json()["status"] == "running"
    assert job["status"] == "succeeded"
    assert job["firmware_bytes"] == len(FIRMWARE)
    assert "Sketch uses" in job["output"]
    assert job["finished_at"] is not None
    assert service.calls == [(CODE, "esp32")]


def test_the_firmware_itself_is_never_sent_to_the_page(client, account, service):
    headers = account()["headers"]
    product = create_product(client, headers)

    job_id = start(client, headers, product).json()["id"]
    body = client.get(f"/products/{product}/compile/{job_id}", headers=headers).text

    assert "firmware-bytes" not in body
    assert base64.b64encode(FIRMWARE).decode() not in body


def test_the_firmware_is_kept_for_uploading_later(client, account, service, db_session):
    headers = account()["headers"]
    product = create_product(client, headers)

    job_id = start(client, headers, product).json()["id"]

    db_session.expire_all()
    assert db_session.get(CompileJob, uuid.UUID(job_id)).firmware == FIRMWARE


def firmware_of(db_session, job_id):
    db_session.expire_all()
    return db_session.get(CompileJob, uuid.UUID(job_id)).firmware


def test_only_the_newest_firmware_of_a_product_is_kept(client, account, service, db_session):
    headers = account()["headers"]
    product = create_product(client, headers)
    service.answer = compile_service.CompileOutcome(ok=True, output="first", firmware=b"first-firmware")
    first = start(client, headers, product).json()["id"]
    service.answer = compile_service.CompileOutcome(ok=True, output="second", firmware=b"second-firmware")
    second = start(client, headers, product).json()["id"]

    assert firmware_of(db_session, first) is None
    assert firmware_of(db_session, second) == b"second-firmware"
    # The size stays as history, and the page still shows it.
    old = client.get(f"/products/{product}/compile/{first}", headers=headers).json()
    assert old["firmware_bytes"] == len(b"first-firmware")


def test_a_failed_compile_keeps_the_last_good_firmware(client, account, service, db_session):
    headers = account()["headers"]
    product = create_product(client, headers)
    good = start(client, headers, product).json()["id"]
    service.answer = compile_service.CompileOutcome(ok=False, output="error: expected ';'")

    start(client, headers, product)

    assert firmware_of(db_session, good) == FIRMWARE


def test_an_unreachable_service_keeps_the_last_good_firmware(client, account, service, db_session):
    headers = account()["headers"]
    product = create_product(client, headers)
    good = start(client, headers, product).json()["id"]
    service.unavailable = True

    start(client, headers, product)

    assert firmware_of(db_session, good) == FIRMWARE


def test_another_product_s_firmware_is_not_touched(client, account, service, db_session):
    headers = account()["headers"]
    helmet = create_product(client, headers, "Helmet")
    switch = create_product(client, headers, "Switch")
    helmet_job = start(client, headers, helmet).json()["id"]

    start(client, headers, switch)

    assert firmware_of(db_session, helmet_job) == FIRMWARE


def test_the_code_itself_is_not_kept(client, account, service, db_session):
    headers = account()["headers"]
    product = create_product(client, headers)

    start(client, headers, product, code='const char* WIFI_PASSWORD = "home-wifi-123";\n' + CODE)

    db_session.expire_all()
    for job in db_session.query(CompileJob).all():
        assert "home-wifi-123" not in job.output


def test_a_compile_error_is_shown_as_a_failed_job(client, account, service):
    headers = account()["headers"]
    product = create_product(client, headers)
    service.answer = compile_service.CompileOutcome(ok=False, output="sketch.ino:2:1: error: expected ';'")

    job_id = start(client, headers, product).json()["id"]
    job = client.get(f"/products/{product}/compile/{job_id}", headers=headers).json()

    assert job["status"] == "failed"
    assert "expected ';'" in job["output"]
    assert job["firmware_bytes"] is None


def test_an_unreachable_service_still_finishes_the_job(client, account, service):
    headers = account()["headers"]
    product = create_product(client, headers)
    service.unavailable = True

    job_id = start(client, headers, product).json()["id"]
    job = client.get(f"/products/{product}/compile/{job_id}", headers=headers).json()

    assert job["status"] == "failed"
    assert job["finished_at"] is not None
    # The person gets a plain sentence, not the reason meant for the logs.
    assert "could not be reached" in job["output"]
    assert "pretend outage" not in job["output"]


def test_without_the_service_set_up_verify_says_so(client, account, service, monkeypatch):
    monkeypatch.setattr(compile_service, "is_configured", lambda: False)
    headers = account()["headers"]
    product = create_product(client, headers)

    response = start(client, headers, product)

    assert response.status_code == 503
    assert "isn't set up" in response.json()["detail"]
    assert service.calls == []


def test_another_company_cannot_compile_or_read_a_compile(client, account, service):
    owner = account(org_name="Factory A")["headers"]
    stranger = account(org_name="Factory B")["headers"]
    product = create_product(client, owner)
    job_id = start(client, owner, product).json()["id"]

    assert start(client, stranger, product).status_code == 404
    assert client.get(f"/products/{product}/compile/{job_id}", headers=stranger).status_code == 404
    # Not even through one of their own products.
    their_product = create_product(client, stranger, "Their product")
    assert client.get(f"/products/{their_product}/compile/{job_id}", headers=stranger).status_code == 404


def test_nobody_compiles_without_logging_in(client, account, service):
    product = create_product(client, account()["headers"])
    client.cookies.clear()

    assert client.post(f"/products/{product}/compile", json={"code": CODE}).status_code == 401
    assert service.calls == []


@pytest.mark.parametrize(
    "payload",
    [
        {"code": "", "board": "esp32"},
        {"code": "   \n", "board": "esp32"},
        {"code": "a" * (64 * 1024 + 1), "board": "esp32"},
        {"code": CODE, "board": "arduino-uno"},
        {"code": CODE, "board": "esp32 --upload"},
    ],
    ids=["empty", "only-spaces", "too-big", "unknown-board", "board-with-extra-options"],
)
def test_bad_requests_never_reach_the_service(client, account, service, payload):
    headers = account()["headers"]
    product = create_product(client, headers)

    response = client.post(f"/products/{product}/compile", json=payload, headers=headers)

    assert response.status_code == 422
    assert service.calls == []


def test_only_one_compile_at_a_time_per_company(client, account, service, db_session):
    me = account(org_name="Factory A")
    headers = me["headers"]
    product = create_product(client, headers)
    org_id = client.get("/auth/me", headers=headers).json()["org_id"]
    db_session.add(CompileJob(org_id=uuid.UUID(org_id), product_id=uuid.UUID(product), board="esp32", status="running", output=""))
    db_session.flush()

    response = start(client, headers, product)

    assert response.status_code == 429
    assert service.calls == []
    # Another company is not held up by it.
    other = account(org_name="Factory B")["headers"]
    assert start(client, other, create_product(client, other)).status_code == 202


def test_a_lost_job_does_not_block_the_company_forever(client, account, service, db_session):
    headers = account()["headers"]
    product = create_product(client, headers)
    org_id = client.get("/auth/me", headers=headers).json()["org_id"]
    lost = CompileJob(
        org_id=uuid.UUID(org_id),
        product_id=uuid.UUID(product),
        board="esp32",
        status="running",
        output="",
        created_at=datetime.now(timezone.utc) - timedelta(minutes=30),
    )
    db_session.add(lost)
    db_session.flush()
    # Read now: the background job closes the shared test session.
    lost_id = lost.id

    assert start(client, headers, product).status_code == 202
    shown = client.get(f"/products/{product}/compile/{lost_id}", headers=headers).json()
    assert shown["status"] == "failed"
    assert "interrupted" in shown["output"]


def test_the_hourly_limit_stops_the_next_compile(client, account, service, monkeypatch):
    monkeypatch.setattr(settings, "compiles_per_hour", 3)
    headers = account()["headers"]
    product = create_product(client, headers)

    answers = [start(client, headers, product).status_code for _ in range(4)]

    assert answers == [202, 202, 202, 429]
    assert len(service.calls) == 3


def test_compiles_older_than_an_hour_do_not_count(client, account, service, monkeypatch, db_session):
    monkeypatch.setattr(settings, "compiles_per_hour", 1)
    headers = account()["headers"]
    product = create_product(client, headers)
    org_id = client.get("/auth/me", headers=headers).json()["org_id"]
    db_session.add(
        CompileJob(
            org_id=uuid.UUID(org_id),
            product_id=uuid.UUID(product),
            board="esp32",
            status="succeeded",
            output="",
            created_at=datetime.now(timezone.utc) - timedelta(minutes=61),
        )
    )
    db_session.flush()

    assert start(client, headers, product).status_code == 202


@pytest.mark.parametrize(
    "last_hour, running, expected",
    [
        (0, 0, None),
        (19, 0, None),
        (20, 0, "limit"),
        (25, 0, "limit"),
        (0, 1, "at a time"),
        (20, 1, "at a time"),
    ],
)
def test_the_refusal_rule_itself(last_hour, running, expected):
    reason = compile_router.refusal(last_hour, running, per_hour=20)

    if expected is None:
        assert reason is None
    else:
        assert reason is not None
        assert expected in reason.lower()
