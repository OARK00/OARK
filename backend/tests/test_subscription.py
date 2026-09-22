"""How the listener subscribes: the part that decides whether two running
copies share the work or duplicate it."""
from app.core.config import settings
from app.modules.ingestion.mqtt_client import (
    TELEMETRY_TOPIC_FILTER,
    client_identifier,
    share_group,
    subscription_filter,
)


def test_the_subscription_is_shared_not_duplicated():
    """$share/<group>/ is what makes the broker hand each message to exactly
    one listener in the group, instead of a copy to every listener."""
    assert subscription_filter() == f"$share/{share_group()}/{TELEMETRY_TOPIC_FILTER}"


def test_each_environment_has_its_own_group(monkeypatch):
    """A laptop must never take production's messages away from production."""
    monkeypatch.setattr(settings, "app_env", "development")
    development = share_group()
    monkeypatch.setattr(settings, "app_env", "production")

    assert development != share_group()


def test_every_listener_gets_its_own_client_id():
    """Two MQTT clients with the same id disconnect each other in a loop."""
    assert client_identifier() != client_identifier()
    assert client_identifier().startswith(f"oark-listener-{settings.app_env}-")
