"""Live state of the MQTT listener, so /health can report it.

Deliberately importing nothing from the rest of the app: both the ingestion
loop (which writes it) and the health check (which reads it) depend on this,
and neither should have to import the other.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class IngestionState:
    connected: bool = False
    connected_since: datetime | None = None
    last_message_at: datetime | None = None
    last_error: str | None = None
    # When the listener stopped being connected, kept across retries so a long
    # outage isn't hidden by its own reconnect attempts. Starts at process
    # start, so a backend that has never connected counts as just-disconnected.
    disconnected_since: datetime | None = field(default_factory=_now)

    def mark_connected(self) -> None:
        self.connected = True
        self.connected_since = _now()
        self.disconnected_since = None
        self.last_error = None

    def mark_disconnected(self, error: str) -> None:
        self.connected = False
        self.last_error = error
        if self.disconnected_since is None:
            self.disconnected_since = _now()

    def disconnected_for_seconds(self) -> float | None:
        """None while connected; otherwise how long it has been down."""
        if self.connected or self.disconnected_since is None:
            return None
        return round((_now() - self.disconnected_since).total_seconds(), 1)


ingestion_state = IngestionState()
