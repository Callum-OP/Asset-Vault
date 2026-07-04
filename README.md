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
- The dev server proxies API routes to the backend. If the backend is **not** on
  `:8000`, point the proxy at it: `VITE_API_TARGET=http://127.0.0.1:8001 npm run dev`
  (PowerShell: `$env:VITE_API_TARGET="http://127.0.0.1:8001"; npm run dev`).
- Optional `frontend/.env` keys: `VITE_API_TARGET`, `VITE_GOOGLE_CLIENT_ID`.

### Frontend — test
```bash
cd frontend
npm run build                 # type-check + production build
npm test                      # Vitest component smoke tests
```

## Environment notes (this machine)
- **System TLS certificates:** package registries are behind a custom root CA.
  - `uv` is configured via `backend/pyproject.toml` (`[tool.uv] system-certs = true`) — no action needed.
  - For **npm**, run installs with the system CA: `NODE_OPTIONS=--use-system-ca npm install`
    (PowerShell: `$env:NODE_OPTIONS="--use-system-ca"; npm install`).
- **IPv4 vs IPv6:** uvicorn binds IPv4 `127.0.0.1`; use `127.0.0.1` (not `localhost`) when
  curling the backend directly. The Vite dev proxy already targets `127.0.0.1`.
- **Postgres:** local server on `:5432`, default `postgres`/`postgres`, database `assetvault`.

## Authentication
The API supports two ways to sign in, both of which return the same app JWT:
- **Email + password** — `POST /auth/register`, then `POST /auth/login`.
- **Sign in with Google** (passwordless) — the browser gets a Google ID token and
  posts it to `POST /auth/google`; the backend verifies it and logs the user in,
  creating (or linking) the account automatically.

Google Sign-In is **optional** and stays disabled until you set `GOOGLE_CLIENT_ID`.
While disabled, `POST /auth/google` returns `503`; the rest of auth is unaffected.

### Google Sign-In setup
You need a free **OAuth Client ID** from Google. It's public (safe to commit to
`.env` locally), and there is no secret to manage with this flow.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (or pick an existing one).
2. **APIs & Services → OAuth consent screen**: choose **External**, give the app a
   name and your email, and save. Add yourself under **Test users**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add `http://localhost:5173` (the frontend).
   - Create it and copy the **Client ID** (looks like
     `1234567890-abc123.apps.googleusercontent.com`).
4. Paste the **same** Client ID into **both** places:
   - `backend/.env` (verifies the token server-side):
     ```
     GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
     ```
   - `frontend/.env` (renders the button):
     ```
     VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
     ```
5. Restart the backend and the frontend dev server. A "Sign in with Google"
   button now appears on the login/register pages, and `POST /auth/google`
   verifies real Google tokens.

> Until `VITE_GOOGLE_CLIENT_ID` is set, the Google button is simply hidden and
> email/password auth works as normal.

## Project layout
```
Asset-Vault/
├── backend/    # FastAPI service
└── frontend/   # Vite React app
```
