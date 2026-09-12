"""Local dev entry point (Windows).

Sets the asyncio event loop policy before uvicorn creates its loop, so the
MQTT client's socket integration works. Must run before `import uvicorn` --
setting the policy from inside app.main is too late, since uvicorn's own
event loop already exists by the time it imports the app.
"""
import asyncio
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
