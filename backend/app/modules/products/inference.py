"""Suggest a product's data points from what its devices actually send."""

# Longest first, so "soil_moisture" matches before "moisture" would.
UNIT_HINTS = sorted(
    {
        "temperature": "°C",
        "temp": "°C",
        "humidity": "%",
        "moisture": "%",
        "battery": "%",
        "pressure": "hPa",
        "voltage": "V",
        "current": "A",
        "power": "W",
        "energy": "kWh",
        "rssi": "dBm",
        "co2": "ppm",
        "lux": "lx",
        "speed": "km/h",
    }.items(),
    key=lambda item: len(item[0]),
    reverse=True,
)

SCALAR_TYPES = (bool, int, float, str)


def infer_type(values: list) -> str:
    """Return "number", "boolean" or "string" for one data point.

    `values` is every value seen for that key, newest first. It is never
    empty, and holds only bool, int, float and str (no None, lists or dicts).
    """
    if all(isinstance(v, bool) for v in values):
        return "boolean"
    if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
        return "number"
    return "string"


def guess_unit(key: str) -> str | None:
    lowered = key.lower()
    for hint, unit in UNIT_HINTS:
        if hint in lowered:
            return unit
    return None


def humanize(key: str) -> str:
    words = key.replace("_", " ").replace("-", " ").split()
    return " ".join(words).capitalize() if words else key


def suggest_data_points(readings: list[dict], existing: list[dict]) -> list[dict]:
    """Merge the saved definition with what `readings` (newest first) contain.

    Saved data points keep the user's choices and only gain fresh
    observations; keys seen in telemetry but not yet defined become new
    suggestions, sorted by key. Postgres JSONB doesn't keep the order a
    device sent its fields in, so alphabetical is the only stable order.
    """
    observed: dict[str, list] = {}
    for data in readings:
        if not isinstance(data, dict):
            continue
        for key, value in data.items():
            if isinstance(value, SCALAR_TYPES):
                observed.setdefault(key, []).append(value)

    suggestions = []
    defined_keys = set()

    for point in existing:
        defined_keys.add(point["key"])
        suggestions.append({**point, "defined": True, **_observations(observed.get(point["key"], []))})

    for key, values in sorted(observed.items()):
        if key in defined_keys:
            continue
        point_type = infer_type(values)
        suggestions.append(
            {
                "key": key,
                "label": humanize(key),
                "type": point_type,
                "unit": guess_unit(key) if point_type == "number" else None,
                "min": None,
                "max": None,
                "access": "read",
                "defined": False,
                **_observations(values),
            }
        )

    return suggestions


def _observations(values: list) -> dict:
    numbers = [v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    return {
        "sample_count": len(values),
        "last_value": values[0] if values else None,
        "observed_min": min(numbers) if numbers else None,
        "observed_max": max(numbers) if numbers else None,
    }
