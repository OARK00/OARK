"""Run the ingestion listener on its own.

    python listener.py

Locally this is the second terminal, next to dev_server.py. On Render it is
the start command of its own service, with PORT provided by the platform.
The asyncio policy note in dev_server.py applies here for the same reason.
"""
import asyncio
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.listener_app:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8001)))
