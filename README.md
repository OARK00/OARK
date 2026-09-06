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
