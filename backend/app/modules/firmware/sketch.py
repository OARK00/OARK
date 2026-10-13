"""Rules for firmware code before it is saved.

The code belongs to a product, and many people in a company can open a
product. A device's secret belongs to one device. So a saved sketch never
keeps a secret: the page shows a placeholder and the real one is pasted into
the board's copy only.
"""
import re

# The same text the Firmware page shows where the secret goes.
SECRET_PLACEHOLDER = "your-device-secret"

# The largest sketch Oark stores, counted in bytes (not letters).
MAX_SKETCH_BYTES = 64 * 1024

_SECRET_LINE = re.compile(r'(DEVICE_SECRET\s*=\s*")[^"\n]*(")')


def hide_secret(code: str) -> str:
    """The code with any pasted device secret replaced by the placeholder."""
    return _SECRET_LINE.sub(rf"\g<1>{SECRET_PLACEHOLDER}\g<2>", code)


def check_size(code: str) -> str:
    """Return the code if Oark can store it; raise ValueError with a message
    for the user if it is empty or too big."""
    if not code.strip():
        raise ValueError("The code cannot be empty.")
    # ">" and not ">=": code of exactly the limit is still allowed.
    if len(code.encode("utf-8")) > MAX_SKETCH_BYTES:
        raise ValueError("The code is too big to save. The limit is 64 KB.")
    return code


def clean_sketch(code: str) -> str:
    """What gets saved: checked for size, with no device secret in it."""
    return hide_secret(check_size(code))
