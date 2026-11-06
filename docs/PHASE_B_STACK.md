# Phase B — full-stack stack decision

| Layer | Choice | Rationale |
|--------|--------|-----------|
| Runtime | Node.js 20 LTS | Matches existing tooling; widely supported on EU hosts |
| API | **Fastify** | Lightweight, schema-friendly, fast for read-heavy NGO data |
| ORM | **Prisma** | Migrations, type-safe queries, Postgres-first |
| Database | **PostgreSQL** (EU region in production) | JSONB for flexible bundles + relational audit trail |
| IdP (later) | **Pluggable** — recommend **Clerk** or **Microsoft Entra ID** for stewards; `STEWARD_API_KEYS` for MVP | API keys ship first; OIDC can replace or complement for enterprise |
| Hosting | EU Postgres (Neon eu-central-1, or Supabase EU, or Azure EU) + API on Fly.io/Render/Azure Container Apps | Data residency call in [LEGAL_NOTICE.md](./LEGAL_NOTICE.md) |

## Environment (MVP)

- `DATABASE_URL` — PostgreSQL connection string (pooled in prod).
- `STEWARD_API_KEYS` — Comma-separated keys for `/api/admin/*` (rotate; never commit).
- `CORS_ORIGIN` — Origin allowed for steward UI (e.g. `https://your-desk.example` or `http://localhost:3000`).

See [server/README.md](../server/README.md) for run instructions.
