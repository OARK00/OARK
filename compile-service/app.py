"""Oark's compile service: code in, firmware out.

Kept apart from the Oark backend on purpose. Compiling is heavy and runs
strangers' code through a compiler; if this falls over, devices, alerts and
logins are untouched. It holds no secrets and cannot reach Oark's database.

Who may call it is decided before a request arrives: the service is deployed
"authentication required", so only Oark's backend, with its own Google
identity, gets through. There is no key in here to steal.
"""
import base64
import threading

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

from compiler import SketchRefused, compile_sketch

app = FastAPI(title="Oark compile service")

# One compile at a time: they share a build folder. The service is also
# deployed with concurrency 1, so this only ever matters if that is changed.
_busy = threading.Lock()


class CompileRequest(BaseModel):
    code: str
    board: str = "esp32"


class CompileResponse(BaseModel):
    ok: bool
    output: str
    # The firmware as base64 text, when the compile succeeded.
    firmware: str | None = None
    firmware_bytes: int | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/compile", response_model=CompileResponse)
def compile_code(request: CompileRequest):
    if not _busy.acquire(blocking=False):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Busy with another compile. Try again in a minute.")
    try:
        result = compile_sketch(request.code, request.board)
    except SketchRefused as refused:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(refused))
    finally:
        _busy.release()

    if result.firmware is None:
        return CompileResponse(ok=False, output=result.output)
    return CompileResponse(
        ok=True,
        output=result.output,
        firmware=base64.b64encode(result.firmware).decode("ascii"),
        firmware_bytes=len(result.firmware),
    )
