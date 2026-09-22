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

`/health` is not decorative: it runs `SELECT 1` and reports the MQTT listener. A broker gap under two minutes reads as `waiting` (200) because cold starts and reconnects are normal; a longer one is `degraded` (503), and an unreachable database is `down` (503). Point an uptime monitor at `https://api.oark.in/health`.

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
