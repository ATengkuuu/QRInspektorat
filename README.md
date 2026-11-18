# QRInspektorat backend

## Local environment

Copy `.env.example` to `.env` and set:
Apa 
- `DATABASE_URL`: Supabase PostgreSQL Transaction Pooler URL.
- `DATABASE_SSL=true`: required for the Supabase pooler.
- `JWT_SECRET`: a private random secret for local development.
- `FRONTEND_URL`: comma-separated frontend origins allowed by CORS.
- `SMTP_*`: optional settings required by the forgot-password OTP flow.

Do not expose `DATABASE_URL`, `JWT_SECRET`, or SMTP credentials through `VITE_*` variables.

## Database setup

For a new database, review and run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor.

For the existing empty tables, review [`supabase/migration_existing_database.sql`](./supabase/migration_existing_database.sql) before running it. The migration is not executed by the application and does not reset tables or data.

## Run locally

```powershell
npm install
npm run dev:full
```

The frontend runs on `http://localhost:5173` and the API runs on `http://localhost:3001`.

Read-only health check:

```text
http://localhost:3001/api/health
```

## Validation

```powershell
npx tsc --noEmit --target ES2020 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck server\index.ts api\index.ts
npm run build
```
