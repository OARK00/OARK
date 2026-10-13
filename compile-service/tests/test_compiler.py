"""The compile service, with a pretend compiler in place of the Arduino CLI.

The real compiler is slow and is exercised when the image is built. What is
tested here is everything around it: what it is told, what it is not told
(secrets), the limits, and that one person's sketch is gone before the next.
"""
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as service  # noqa: E402
import compiler  # noqa: E402

CODE = "void setup() {}\nvoid loop() {}\n"


@pytest.fixture(autouse=True)
def folders(tmp_path, monkeypatch):
    monkeypatch.setattr(compiler, "WORK_DIR", tmp_path / "work")
    monkeypatch.setattr(compiler, "WARM_DIR", tmp_path / "warm")
    return tmp_path


class PretendCompiler:
    """Stands in for `arduino-cli compile`: records how it was called and
    behaves like a compile that worked, failed, or never finished."""

    def __init__(self, firmware=b"\xe9firmware", returncode=0, stdout="Sketch uses 1024 bytes.", stderr="", hangs=False):
        self.firmware, self.returncode, self.stdout, self.stderr, self.hangs = firmware, returncode, stdout, stderr, hangs
        self.calls = []

    def __call__(self, command, **options):
        sketch_dir = Path(command[-1])
        self.calls.append({"command": command, "options": options, "source": (sketch_dir / "sketch.ino").read_text(encoding="utf-8")})
        if self.hangs:
            raise subprocess.TimeoutExpired(command, options["timeout"])
        build_dir = Path(command[command.index("--build-path") + 1])
        # The real tool keeps its own copy of the source in the build folder.
        (build_dir / "sketch").mkdir(parents=True, exist_ok=True)
        (build_dir / "sketch" / "sketch.ino.cpp").write_text(self.calls[-1]["source"], encoding="utf-8")
        (build_dir / "core.a").write_text("the board's system code, built once")
        if self.firmware is not None:
            out_dir = Path(command[command.index("--output-dir") + 1])
            (out_dir / "sketch.ino.bin").write_bytes(self.firmware)
        return subprocess.CompletedProcess(command, self.returncode, self.stdout, self.stderr)


def test_a_good_sketch_gives_back_its_firmware():
    pretend = PretendCompiler(firmware=b"\xe9\x01\x02")

    result = compiler.compile_sketch(CODE, "esp32", run=pretend)

    assert result.ok is True
    assert result.firmware == b"\xe9\x01\x02"
    assert "Sketch uses 1024 bytes." in result.output
    assert pretend.calls[0]["source"] == CODE


@pytest.mark.parametrize("board, fqbn", [("esp32", "esp32:esp32:esp32"), ("esp8266", "esp8266:esp8266:nodemcuv2")])
def test_the_compiler_is_told_the_right_board(board, fqbn):
    pretend = PretendCompiler()

    compiler.compile_sketch(CODE, board, run=pretend)

    command = pretend.calls[0]["command"]
    assert command[:2] == ["arduino-cli", "compile"]
    assert command[command.index("--fqbn") + 1] == fqbn


def test_each_board_reuses_its_own_prebuilt_folder(folders):
    pretend = PretendCompiler()

    compiler.compile_sketch(CODE, "esp32", run=pretend)
    compiler.compile_sketch(CODE, "esp8266", run=pretend)

    builds = [call["command"][call["command"].index("--build-path") + 1] for call in pretend.calls]
    assert builds == [str(folders / "warm" / "esp32"), str(folders / "warm" / "esp8266")]
    # The slow part, built once, is still there for the next compile.
    assert (folders / "warm" / "esp32" / "core.a").is_file()


def test_the_sketch_always_sits_at_the_same_path():
    """The Arduino CLI rebuilds everything when the sketch location changes."""
    pretend = PretendCompiler()

    compiler.compile_sketch(CODE, "esp32", run=pretend)
    compiler.compile_sketch("// another\n" + CODE, "esp32", run=pretend)

    assert pretend.calls[0]["command"][-1] == pretend.calls[1]["command"][-1]


def test_the_compiler_never_sees_this_process_s_secrets(monkeypatch):
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/secrets/key.json")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:password@host/db")
    monkeypatch.setenv("SOME_API_TOKEN", "t0ken")
    monkeypatch.setenv("PATH", "/usr/local/bin")
    pretend = PretendCompiler()

    compiler.compile_sketch(CODE, "esp32", run=pretend)

    env = pretend.calls[0]["options"]["env"]
    assert env["PATH"] == "/usr/local/bin"
    assert set(env) <= set(compiler.SAFE_ENV_NAMES)
    assert not any("password" in value or "t0ken" in value or "key.json" in value for value in env.values())


def test_nothing_of_a_sketch_is_left_for_the_next_person(folders):
    secret_code = '// my private idea\nconst char* WIFI_PASSWORD = "home-wifi-123";\n' + CODE
    compiler.compile_sketch(secret_code, "esp32", run=PretendCompiler())

    left = [path for path in folders.rglob("*") if path.is_file()]
    assert not any("home-wifi-123" in path.read_text(errors="ignore") for path in left)
    assert not (folders / "work" / "sketch").exists()
    assert not (folders / "work" / "out").exists()
    assert not (folders / "warm" / "esp32" / "sketch").exists()


def test_it_is_cleaned_up_after_a_failed_compile_too(folders):
    compiler.compile_sketch('const char* k = "left-behind";\n', "esp32", run=PretendCompiler(firmware=None, returncode=1))

    left = [path for path in folders.rglob("*") if path.is_file()]
    assert not any("left-behind" in path.read_text(errors="ignore") for path in left)


def test_a_compile_error_is_reported_not_raised():
    pretend = PretendCompiler(firmware=None, returncode=1, stdout="", stderr="sketch.ino:3:1: error: expected ';'")

    result = compiler.compile_sketch(CODE, "esp32", run=pretend)

    assert result.ok is False
    assert result.firmware is None
    assert "expected ';'" in result.output


def test_success_needs_both_a_clean_exit_and_a_firmware_file():
    no_file = compiler.compile_sketch(CODE, "esp32", run=PretendCompiler(firmware=None, returncode=0))
    bad_exit = compiler.compile_sketch(CODE, "esp32", run=PretendCompiler(firmware=b"x", returncode=1))

    assert no_file.ok is False and no_file.firmware is None
    assert bad_exit.ok is False and bad_exit.firmware is None


def test_a_compile_that_never_finishes_is_stopped():
    pretend = PretendCompiler(hangs=True)

    result = compiler.compile_sketch(CODE, "esp32", run=pretend)

    assert result.ok is False
    assert "stopped" in result.output
    assert pretend.calls[0]["options"]["timeout"] == compiler.COMPILE_TIMEOUT_SECONDS


def test_error_messages_do_not_show_this_machine_s_folders(folders):
    where = str(folders / "work" / "sketch")
    pretend = PretendCompiler(firmware=None, returncode=1, stderr=f"{where}{compiler.os.sep}sketch.ino:2:5: error: 'x' was not declared")

    result = compiler.compile_sketch(CODE, "esp32", run=pretend)

    assert str(folders) not in result.output
    assert "sketch.ino:2:5: error" in result.output


def test_very_long_compiler_output_is_cut():
    pretend = PretendCompiler(firmware=None, returncode=1, stderr="e" * (compiler.MAX_OUTPUT_CHARS * 3))

    result = compiler.compile_sketch(CODE, "esp32", run=pretend)

    assert len(result.output) < compiler.MAX_OUTPUT_CHARS + 100
    assert result.output.endswith("(output cut here)")


@pytest.mark.parametrize(
    "code, board, words",
    [
        (CODE, "arduino-uno", "Unknown board"),
        (CODE, "esp32:esp32:esp32 --upload", "Unknown board"),
        ("", "esp32", "empty"),
        ("  \n\t ", "esp32", "empty"),
        ("a" * (compiler.MAX_SKETCH_BYTES + 1), "esp32", "too big"),
        ("म" * (compiler.MAX_SKETCH_BYTES // 3 + 1), "esp32", "too big"),
    ],
    # Short names: by default the whole 64 KB sketch becomes the test's name.
    ids=["unknown-board", "board-with-extra-options", "empty", "only-spaces", "one-byte-too-big", "too-big-in-bytes-not-letters"],
)
def test_bad_requests_are_refused_before_the_compiler_runs(code, board, words):
    pretend = PretendCompiler()

    with pytest.raises(compiler.SketchRefused, match=words):
        compiler.compile_sketch(code, board, run=pretend)

    assert pretend.calls == []


def test_code_at_exactly_the_size_limit_is_compiled():
    pretend = PretendCompiler()

    result = compiler.compile_sketch("a" * compiler.MAX_SKETCH_BYTES, "esp32", run=pretend)

    assert result.ok is True


# --- the web side ---


@pytest.fixture()
def client(monkeypatch):
    pretend = PretendCompiler(firmware=b"\xe9\x00\xff")
    monkeypatch.setattr(service, "compile_sketch", lambda code, board: compiler.compile_sketch(code, board, run=pretend))
    return TestClient(service.app)


def test_the_service_answers_with_firmware_as_text(client):
    import base64

    response = client.post("/compile", json={"code": CODE, "board": "esp32"})

    body = response.json()
    assert response.status_code == 200
    assert body["ok"] is True
    assert base64.b64decode(body["firmware"]) == b"\xe9\x00\xff"
    assert body["firmware_bytes"] == 3


def test_a_refused_sketch_is_a_422_with_the_reason(client):
    response = client.post("/compile", json={"code": CODE, "board": "toaster"})

    assert response.status_code == 422
    assert "Unknown board" in response.json()["detail"]


def test_a_second_compile_at_the_same_moment_is_turned_away(client):
    assert service._busy.acquire(blocking=False)
    try:
        response = client.post("/compile", json={"code": CODE, "board": "esp32"})
    finally:
        service._busy.release()

    assert response.status_code == 429
    # And it works again once the first one is done.
    assert client.post("/compile", json={"code": CODE, "board": "esp32"}).status_code == 200


def test_the_service_is_free_again_after_a_refused_sketch(client):
    client.post("/compile", json={"code": "", "board": "esp32"})

    assert client.post("/compile", json={"code": CODE, "board": "esp32"}).status_code == 200
