# OARK

Industrial-grade IoT device monitoring and analytics platform. Devices connect over MQTT, send live telemetry, and appear on a real-time dashboard with device management, alerts, and analytics.

## Architecture

Modular monolith (not microservices): one deployable backend service with clean internal module boundaries — Auth, Orgs, Devices, Ingestion, Telemetry, Rules, Notifications.

- **Backend** — Python, FastAPI, SQLAlchemy, Alembic
- **Frontend** — React (Vite)
- **Database** — PostgreSQL (Supabase)
- **MQTT broker** — EMQX

## Backend setup (local dev)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # then fill in the DEVELOPMENT database's DATABASE_URL and a new JWT_SECRET
alembic upgrade head
python label_database.py development   # once, for a new database
python dev_server.py
```

Local development never uses the production database. Each database holds a label (`development`, `test` or `production`), and the backend and migrations refuse to run when it doesn't match `APP_ENV`.

## Checks

```bash
cd backend
pip install -r requirements-dev.txt
mypy       # type checking, config in mypy.ini
pytest     # tests; each one runs in a transaction that is rolled back
```

Both run on every push through `.github/workflows/ci.yml`, against a throwaway Postgres created for that run. The suite refuses to start if `APP_ENV=production` or the database's label disagrees.

## Ingestion

The MQTT listener can run inside the web API (`INGESTION_IN_API=true`, one process) or as its own service (`python listener.py`, which also serves `/health` on `PORT`). Splitting it means a deploy or crash of the API cannot stop device data; the API's `/health` then stops reporting ingestion, and the listener's own `/health` is what to monitor.

Listeners subscribe as `$share/oark-ingest-<environment>/oark/devices/+/telemetry`. The `$share` prefix makes the broker give each message to exactly **one** listener in the group, so running two of them doubles capacity instead of storing every reading twice. The group name carries the environment so a developer's laptop can never take production's messages.

`/health` is not decorative: it runs `SELECT 1` and reports the MQTT listener. A broker gap under two minutes reads as `waiting` (200) because cold starts and reconnects are normal; a longer one is `degraded` (503), and an unreachable database is `down` (503). Point an uptime monitor at `https://api.oark.in/health`.

## Commands

A data point marked `write` on a product can be set from the device page. `POST /devices/{id}/commands` checks the value against the data point (type, min/max), records who sent it, and publishes `{"desired": {...every value still waiting...}}` to `oark/devices/<id>/commands` through the broker's HTTP API (QoS 1, not retained). The device confirms by reporting the new value in its ordinary telemetry; there is no separate acknowledgement.

A command waits at most five minutes. If the device is offline, a sweep beside the listener resends it once the device is heard from again; after five minutes it expires and is never sent, so nothing switches by itself long after someone asked. The broker lets each device subscribe only to its own commands topic, and only the backend can publish there.

API docs then available at `http://localhost:8000/docs`.

## Frontend setup (local dev)

```bash
cd frontend
npm install
npm run dev
```

## Deployment (Render)

Backend and frontend are deployed as separate Render services (Web Service + Static Site).

- Backend needs `APP_ENV=production`, `DATABASE_URL` (use Supabase's **session pooler** connection string, not the direct IPv6-only one — Render has no IPv4 egress) and `JWT_SECRET` set in Render's Environment tab. The production database URL lives only there.
- Production migrations run in the backend's **Build Command**: `pip install -r requirements.txt && alembic upgrade head`. A failed migration fails the build, and the running version stays live.
- Frontend needs `VITE_API_URL` set to the backend's Render URL, and a **Rewrite** rule under Redirects/Rewrites (`/*` → `/index.html`) so React Router routes don't 404 on direct navigation/refresh — Render does not support Netlify-style `_redirects` files, this must be configured in the dashboard.
