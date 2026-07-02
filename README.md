# LocalAsset Vault

A local/private **Digital Asset Manager (DAM)** for cataloging 2D & 3D creative assets
(`.fbx`, `.obj`, `.gltf/.glb`, `.png`, `.jpg`, `.gif`, videos, textures) with a searchable
visual browser and an interactive Three.js viewport.

See **[DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** for the full roadmap.

## Stack
- **Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL (managed with `uv`)
- **Frontend:** React + Vite + TypeScript + react-three-fiber
- **Auth:** JWT email/password
- **Docs:** Swagger/OpenAPI at `/docs`

## Prerequisites
- Python 3.13+ and [uv](https://docs.astral.sh/uv/)
- Node 20+ and npm
- PostgreSQL 16 running on `localhost:5432`

## Backend — run
```bash
cd backend
uv sync                       # install dependencies into .venv
cp .env.example .env          # then edit DB credentials if needed
uv run uvicorn app.main:app --reload
```
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Backend — test
```bash
cd backend
uv run pytest
```

## Frontend — run
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Environment notes (this machine)
- **System TLS certificates:** package registries are behind a custom root CA.
  - `uv` is configured via `backend/pyproject.toml` (`[tool.uv] system-certs = true`) — no action needed.
  - For **npm**, run installs with the system CA: `NODE_OPTIONS=--use-system-ca npm install`
    (PowerShell: `$env:NODE_OPTIONS="--use-system-ca"; npm install`).
- **IPv4 vs IPv6:** uvicorn binds IPv4 `127.0.0.1`; use `127.0.0.1` (not `localhost`) when
  curling the backend directly. The Vite dev proxy already targets `127.0.0.1`.
- **Postgres:** local server on `:5432`, default `postgres`/`postgres`, database `assetvault`.

## Project layout
```
Asset-Vault/
├── backend/    # FastAPI service
└── frontend/   # Vite React app
```
