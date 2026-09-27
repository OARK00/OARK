"""Publishing to a device over one kept-open connection, with the broker's
side faked at the HTTP client level."""
import httpx
import pytest

from app.core import broker
# Imported before conftest's autouse fixture swaps it for a recorder, so the
# real function is the one under test here.
from app.core.broker import publish_to_device


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code
        self.text = ""


class FakeClient:
    def __init__(self, outcomes: list):
        self.outcomes = outcomes
        self.closed = False
        self.bodies: list[dict] = []

    def post(self, path, json=None):
        self.bodies.append(json)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(outcome)

    def close(self):
        self.closed = True


@pytest.fixture()
def clients(monkeypatch):
    """Each new connection takes its outcomes from the next list queued here."""
    queued: list[FakeClient] = []
    made: list[FakeClient] = []

    def new_client():
        client = queued.pop(0)
        made.append(client)
        return client

    monkeypatch.setattr(broker, "_publish_client", None)
    monkeypatch.setattr(broker, "_new_publish_client", new_client)
    return queued, made


def test_the_connection_is_reused_between_commands(clients):
    queued, made = clients
    queued.append(FakeClient([200, 200]))

    assert publish_to_device("car-1", {"desired": {"drive": "forward"}}) is True
    assert publish_to_device("car-1", {"desired": {"drive": "stop"}}) is True
    assert len(made) == 1


def test_a_connection_the_broker_closed_is_replaced_once(clients):
    queued, made = clients
    stale = FakeClient([httpx.RemoteProtocolError("server closed the connection")])
    queued.extend([stale, FakeClient([200])])

    assert publish_to_device("car-1", {"desired": {"drive": "stop"}}) is True
    assert stale.closed is True
    assert len(made) == 2


def test_a_timeout_is_not_retried(clients):
    """The message may already have reached the car; sending it twice later
    is worse than reporting the failure now."""
    queued, made = clients
    queued.append(FakeClient([httpx.ReadTimeout("slow")]))

    with pytest.raises(broker.BrokerError):
        publish_to_device("car-1", {"desired": {"drive": "forward"}})
    assert len(made) == 1


def test_no_subscriber_means_not_delivered(clients):
    queued, _ = clients
    queued.append(FakeClient([202]))

    assert publish_to_device("car-1", {"desired": {"drive": "forward"}}) is False


def test_the_message_goes_to_that_devices_commands_topic(clients):
    queued, made = clients
    queued.append(FakeClient([200]))

    publish_to_device("car-1", {"desired": {"drive": "left"}})

    body = made[0].bodies[0]
    assert body["topic"] == "oark/devices/car-1/commands"
    assert body["retain"] is False
    assert body["qos"] == 1
