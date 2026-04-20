# Backend (FastAPI + Supabase/Postgres)

Backend owns database initialization and schema files.

## Database Init

1. Create `backend/.env.local` from `backend/.env.example`.
2. Set `SUPABASE_DB_URL` using Supabase Postgres connection string.
3. Install backend Node tooling for init:
	- `npm install`
4. Apply schema:
	- `npm run db:init`

Schema location:
- `backend/supabase/schema.sql`

## API Stack

- FastAPI
- Supabase/Postgres