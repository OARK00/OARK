"""Turns one sketch into firmware with the Arduino CLI.

This runs code that a stranger typed through a compiler, so the rules are:
the compiler gets no secrets (a clean environment), a time limit, and a size
limit; and nothing of one person's sketch is left behind for the next one.

A cold ESP32 build takes minutes, nearly all of it the board's own system
code, which is the same for everyone. The image builds that once per board
into WARM_DIR (see Dockerfile); every compile here reuses it, which is why
the sketch always sits at the same path -- the Arduino CLI throws its build
folder away when the sketch location changes.
"""
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

# The boards Oark offers, by their Arduino name (FQBN).
BOARDS = {
    "esp32": "esp32:esp32:esp32",
    "esp8266": "esp8266:esp8266:nodemcuv2",
}

MAX_SKETCH_BYTES = 64 * 1024
COMPILE_TIMEOUT_SECONDS = 240
# Compiler errors can run to megabytes; the page needs the first screenfuls.
MAX_OUTPUT_CHARS = 20_000

SKETCH_NAME = "sketch"
WORK_DIR = Path(os.environ.get("OARK_WORK_DIR", "/home/builder/work"))
WARM_DIR = Path(os.environ.get("OARK_WARM_DIR", "/home/builder/warm"))

# All the compiler is told about its surroundings. Anything else this process
# knows (cloud credentials, tokens) must not reach a compiler that prints
# parts of whatever a sketch asks it to #include.
SAFE_ENV_NAMES = ("PATH", "HOME", "LANG", "TMPDIR", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA")


class SketchRefused(ValueError):
    """The sketch was not compiled; the message is for the person who sent it."""


@dataclass
class CompileResult:
    ok: bool
    output: str
    firmware: bytes | None = None


def check_request(code: str, board: str) -> None:
    if board not in BOARDS:
        raise SketchRefused(f"Unknown board. Choose one of: {', '.join(sorted(BOARDS))}.")
    if not code.strip():
        raise SketchRefused("The code cannot be empty.")
    if len(code.encode("utf-8")) > MAX_SKETCH_BYTES:
        raise SketchRefused("The code is too big to compile. The limit is 64 KB.")


def safe_env() -> dict[str, str]:
    return {name: os.environ[name] for name in SAFE_ENV_NAMES if name in os.environ}


def trim_output(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + "\n… (output cut here)"


def _hide_paths(text: str, sketch_dir: Path) -> str:
    """Compiler messages name files by their full path on this machine; the
    person only needs to know it is their sketch."""
    return text.replace(str(sketch_dir) + os.sep, "").replace(str(sketch_dir), SKETCH_NAME)


def compile_sketch(code: str, board: str, run=subprocess.run) -> CompileResult:
    """Compile `code` for `board`. One at a time: the caller must not run two
    of these in the same process together (they share the sketch path)."""
    check_request(code, board)

    sketch_dir = WORK_DIR / SKETCH_NAME
    out_dir = WORK_DIR / "out"
    build_dir = WARM_DIR / board
    for folder in (sketch_dir, out_dir):
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True)
    build_dir.mkdir(parents=True, exist_ok=True)
    (sketch_dir / f"{SKETCH_NAME}.ino").write_text(code, encoding="utf-8")

    command = [
        "arduino-cli", "compile",
        "--fqbn", BOARDS[board],
        "--build-path", str(build_dir),
        "--output-dir", str(out_dir),
        "--no-color",
        str(sketch_dir),
    ]
    try:
        try:
            done = run(command, capture_output=True, text=True, timeout=COMPILE_TIMEOUT_SECONDS, env=safe_env())
        except subprocess.TimeoutExpired:
            return CompileResult(ok=False, output=f"The compile took longer than {COMPILE_TIMEOUT_SECONDS} seconds and was stopped.")

        output = trim_output(_hide_paths((done.stdout or "") + (done.stderr or ""), sketch_dir))
        firmware_file = out_dir / f"{SKETCH_NAME}.ino.bin"
        if done.returncode != 0 or not firmware_file.is_file():
            return CompileResult(ok=False, output=output or "The compile failed without a message.")
        return CompileResult(ok=True, output=output, firmware=firmware_file.read_bytes())
    finally:
        # Nothing of this sketch stays for the next person: not the source,
        # not the firmware, and not the compiler's own copy of the source.
        for folder in (sketch_dir, out_dir, build_dir / "sketch"):
            shutil.rmtree(folder, ignore_errors=True)
