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
copy .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
alembic revision --autogenerate -m "init"
alembic upgrade head
uvicorn app.main:app --reload
```

API docs then available at `http://localhost:8000/docs`.

## Frontend setup (local dev)

```bash
cd frontend
npm install
npm run dev
```

## Deployment (Render)

Backend and frontend are deployed as separate Render services (Web Service + Static Site).

- Backend needs `DATABASE_URL` (use Supabase's **session pooler** connection string, not the direct IPv6-only one — Render has no IPv4 egress) and `JWT_SECRET` set in Render's Environment tab.
- Frontend needs `VITE_API_URL` set to the backend's Render URL, and a **Rewrite** rule under Redirects/Rewrites (`/*` → `/index.html`) so React Router routes don't 404 on direct navigation/refresh — Render does not support Netlify-style `_redirects` files, this must be configured in the dashboard.
