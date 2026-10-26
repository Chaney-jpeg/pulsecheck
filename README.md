# PulseCheck

**A lightweight API uptime monitoring and incident management MVP.**

PulseCheck lets you register HTTP endpoints, run health checks, review recent response times, and track incidents from detection through recovery. It includes a FastAPI backend and a React dashboard backed by SQLite.

> **project status:** MVP / portfolio project. Checks are triggered manually; this version is not intended to monitor production services unattended.

## Features

- Add, edit, pause, list, and remove monitored services
- Trigger a health check for one service or all active services
- Record check outcomes, HTTP status codes, response times, and failures
- Open an incident after a failed check and resolve it after recovery
- Review recent check history and calculate uptime over a selected period
- Explore the API through FastAPI's interactive OpenAPI documentation
- View service health and active incidents in a responsive dashboard

## Tech stack

| Area | Technology |
|---|---|
| API | Python, FastAPI, SQLModel |
| Database | SQLite |
| HTTP checks | HTTPX |
| Dashboard | React, TypeScript, Vite, Recharts |
| Backend tests | pytest |

## Requirements

- Python 3.10 or newer
- Node.js 20.19 or newer
- npm

## Run locally

Start the API and dashboard in separate terminals from the project root.

### 1. Start the API

```bash
cd backend
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
# .venv\\Scripts\\Activate.ps1

python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive API documentation is at `http://localhost:8000/docs` and the health endpoint is `http://localhost:8000/health`.

The database tables are created automatically on startup. By default, SQLite stores data in `backend/pulsecheck.db` when the API is started from the `backend` directory.

### 2. Start the dashboard

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The dashboard defaults to the API at `http://localhost:8000`.

### Configuration

| Variable | Default | Description |
|---|---|---|
| `PULSECHECK_DATABASE_URL` | `sqlite:///./pulsecheck.db` | SQLModel database connection URL. Relative SQLite paths resolve from the API's current working directory. |
| `PULSECHECK_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated frontend origins allowed by the API. |
| `VITE_API_URL` | `http://localhost:8000` | API origin used by the dashboard. |

Example for a different local API origin:

```bash
# Run before starting the API
export PULSECHECK_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# Run before starting Vite
export VITE_API_URL="http://localhost:8000"
```

## API overview

All application routes are prefixed with `/api` except `/health`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check that the API process is responding |
| `GET` | `/api/services` | List monitored services and their latest status |
| `POST` | `/api/services` | Create a monitored service |
| `GET` | `/api/services/{service_id}` | Get one service |
| `PATCH` | `/api/services/{service_id}` | Update service settings or pause state |
| `DELETE` | `/api/services/{service_id}` | Delete a service and its check and incident history |
| `POST` | `/api/services/{service_id}/checks` | Run a check for one active service |
| `POST` | `/api/checks/run` | Run checks for every active service |
| `GET` | `/api/services/{service_id}/checks` | Get recent checks (`limit` from 1 to 500; default 50) |
| `GET` | `/api/services/{service_id}/uptime` | Calculate uptime (`days` from 1 to 90; default 7) |
| `GET` | `/api/incidents` | List incidents; optionally filter by `state=open` or `state=resolved` |

Example: create a service and trigger a check.

```bash
curl -X POST http://localhost:8000/api/services \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Example API","url":"https://example.com/health","interval_seconds":300}'

curl -X POST http://localhost:8000/api/services/1/checks
```

Service intervals are saved as configuration, but automatic scheduling is not implemented yet. Checks run only when a check endpoint is called.

## Run the tests

```bash
cd backend
python -m pytest
```

The backend tests cover the health endpoint, service lifecycle and validation, and incident opening and recovery behavior.

## Repository layout

```text
.
├── AGENTS.md                 # Engineering standards
├── backend/
│   ├── app/                  # API, persistence, models, and check logic
│   ├── tests/                # Backend tests
│   └── requirements.txt
└── frontend/
    ├── src/                  # Dashboard UI
    ├── package.json
    └── vite.config.ts
```

## Current scope and next steps

This MVP is a single-user local application. It does not currently include authentication, multi-user workspaces, scheduled/background checks, alert delivery, deployment automation, or production-grade monitoring infrastructure.

A production deployment would also need protections against server-side request forgery (SSRF), including destination validation and network egress controls. Monitored URLs cause the API server to make outbound requests, so do not expose this version to untrusted users or run it with access to sensitive internal networks.

Potential next iterations:

1. Add safe URL and DNS/IP validation to prevent requests to private and link-local networks.
2. Run scheduled checks in a background worker and make check execution resilient to restarts.
3. Add authentication, per-user service ownership, and database migrations.
4. Add alert delivery, incident timelines, and configurable failure thresholds.
5. Add CI, deployment configuration, structured logs, and operational health checks.
