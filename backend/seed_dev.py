"""Fill the development database with believable devices and telemetry.

    python seed_dev.py [email]

For looking at the UI with something in it. Refuses to run anywhere but a
development database, and creates no broker logins: these devices exist to
be looked at, not to connect.
"""
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.security import generate_device_secret, hash_device_secret  # noqa: E402
from app.models.device import Device  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.telemetry import TelemetryReading  # noqa: E402
from app.models.user import User  # noqa: E402

if settings.app_env != "development":
    sys.exit(f"Refused: seeding is for development only, this is '{settings.app_env}'")

DEVICES = [
    ("Boiler 2, basement", "sensor", 1, {"temperature": 71.4, "pressure": 3.1}),
    ("Cold store A", "sensor", 4, {"temperature": -18.2, "humidity": 62}),
    ("Pump house feed", "controller", 40, {"flow": 12.8, "running": True}),
    ("Roof weather mast", "sensor", 0, {"temperature": 29.6, "wind": 8.4}),
    ("Line 3 gateway", "gateway", 2400, {"clients": 12}),
]


def wobble(state: dict, hour: int) -> dict:
    """Numbers that drift over the day, the way a real sensor's do.

    A constant value would draw a flat line and make the history chart look
    broken, which is exactly the wrong thing to test a chart against.
    """
    varied = {}
    for key, value in state.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            varied[key] = value
            continue
        spread = max(abs(value) * 0.06, 0.4)
        varied[key] = round(value + spread * math.sin(hour / 3.5) + random.uniform(-spread / 2, spread / 2), 2)
    return varied


def main() -> None:
    db = SessionLocal()
    email = sys.argv[1] if len(sys.argv) > 1 else None
    user = db.query(User).filter(User.email == email).first() if email else db.query(User).first()
    if user is None:
        sys.exit("No user found in the development database. Sign up in the app first.")

    product = db.query(Product).filter(Product.org_id == user.org_id).first()
    if product is None:
        product = Product(
            org_id=user.org_id,
            name="Industrial temperature sensor",
            category="sensor",
            model_number="OARK-TS1",
            data_points=[
                {"key": "temperature", "label": "Temperature", "type": "number", "unit": "°C"},
                {"key": "humidity", "label": "Humidity", "type": "number", "unit": "%"},
            ],
        )
        db.add(product)
        db.flush()

    now = datetime.now(timezone.utc)
    created = 0
    readings = 0

    reset = "--reset" in sys.argv

    for name, category, minutes_ago, state in DEVICES:
        existing = db.query(Device).filter(Device.org_id == user.org_id, Device.name == name).first()
        if existing and reset:
            db.delete(existing)
            db.flush()
        elif existing:
            continue
        last_seen = now - timedelta(minutes=minutes_ago)
        device = Device(
            org_id=user.org_id,
            product_id=product.id if category == "sensor" else None,
            name=name,
            category=category,
            hashed_secret=hash_device_secret(generate_device_secret()),
            reported_state=state,
            last_seen_at=last_seen,
        )
        db.add(device)
        db.flush()
        created += 1

        # A working day's shape rather than a flat line, so the chart shows
        # something a real fleet would produce.
        for hour in range(24):
            recorded_hour = now - timedelta(hours=23 - hour)
            if recorded_hour > last_seen:
                break
            busy = 1.0 + 0.6 * random.random() if 6 <= recorded_hour.hour <= 20 else 0.3 + 0.3 * random.random()
            for _ in range(int(6 * busy)):
                db.add(
                    TelemetryReading(
                        org_id=user.org_id,
                        device_id=device.id,
                        data=wobble(state, hour),
                        recorded_at=recorded_hour + timedelta(minutes=random.randint(0, 59)),
                    )
                )
                readings += 1
        device.reported_state = wobble(state, 23)

    owner = user.email  # read before the session closes and expires the object
    db.commit()
    db.close()
    print(f"Seeded {created} devices and {readings} readings for {owner}")


if __name__ == "__main__":
    main()
