# Backend (FastAPI + Supabase/Postgres)

Backend owns database initialization and schema files.

## Database Init

1. Create backend/.env.local from backend/.env.example.
2. Set SUPABASE_DB_URL using Supabase Postgres connection string.
3. Install backend Node tooling for init:
   - npm install
4. Apply schema:
   - npm run db:init

Schema location:
- backend/supabase/schema.sql

## Python Environment

- python -m venv venv

## API Stack

- FastAPI
- Supabase/Postgres

## Run The Backend

From the repo root:

```powershell
npm run backend:dev
```

Or from the `backend` folder:

```powershell
npm run dev
```

The PowerShell launcher in `backend/run.ps1` will automatically look for the
project virtualenv at `..\.venv`, `.\.venv`, or `.\venv` and start:

```powershell
python -m uvicorn app.main:socket_app --host 127.0.0.1 --port 8000 --reload
```

## AI Model Integration

The backend now exposes an AI copilot endpoint that can ground its answer in the
existing product, supplier conversation, and invoice data.

Add these variables to `backend/.env`:

```env
AI_PROVIDER=gemini
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
AI_MAX_TOKENS=10000
AI_TEMPERATURE=0.2
AI_TIMEOUT_SECONDS=60
```

Useful endpoints:

- `GET /api/v1/ai/status`
- `POST /api/v1/ai/copilot`
