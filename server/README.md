# Greece NGO Desk — Phase B server

Fastify + Prisma + PostgreSQL. Mirrors `window.NGO_DATA` as one row in `DraftBundle` (work in progress) and `PublishedBundle` (public read).

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Liveness |
| GET | `/api/ready` | No | Readiness (DB ping) |
| GET | `/api/ngo-data` | No | Public bundle (same shape as `window.NGO_DATA`), rate-limited |
| GET | `/api/steward-config` | No | `clerkPublishableKey` + `clerkServerConfigured` (for `/steward/` UI) |
| GET | `/api/draft` | Steward key | Current draft |
| PATCH | `/api/draft/registry/organizations/:id` | Steward key | Replace one org object; **publish gate** = full Ajv schema on assembled draft |
| POST | `/api/publish` | Steward key | Copy draft → published |
| GET | `/api/audit?limit=50` | Steward key | Recent audit rows |

**Steward auth:**

- **Clerk (recommended):** set `CLERK_SECRET_KEY` (and `CLERK_PUBLISHABLE_KEY` for the steward UI). The UI at `/steward/` loads Clerk and sends `Authorization: Bearer <session JWT>`. Optional: `CLERK_AUTHORIZED_PARTIES` (comma-separated origins that must match the token’s `azp` check), `CLERK_STEWARD_REQUIRED_ROLE` + `CLERK_STEWARD_ROLE_METADATA_PATH` for a role in `public_metadata`.
- `Authorization: Bearer <apikey>` (matches `STEWARD_API_KEYS`) or `x-steward-key: <apikey>` — break-glass
- **Or** generic `Authorization: Bearer <jwt>` when `STEWARD_JWKS_URL` (+ optional issuer/audience/role) or `STEWARD_JWT_SECRET` (HS256) is set — see `.env.example`

**Audit:** `actorKey` stores a **masked API key** or **JWT `sub`** (Clerk user id) for identification.

## Setup

```powershell
cd server
copy .env.example .env
# Set DATABASE_URL, CLERK_* (see .env.example), and optional STEWARD_API_KEYS

npm ci
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- UI: open `http://127.0.0.1:4000/steward/` (static steward console).
- Public JSON: `GET http://127.0.0.1:4000/api/ngo-data`

## Production notes

- Use **EU** Postgres and restrict network access.
- Prefer **Clerk** (`CLERK_SECRET_KEY` + publishable key) or **JWT via JWKS** (`STEWARD_JWKS_URL`); use long random `STEWARD_API_KEYS` only for break-glass.
- Public routes: **rate limit** on `GET /api/ngo-data` via `RATE_LIMIT_PUBLIC_MAX` / `RATE_LIMIT_PUBLIC_WINDOW_MS`.

Runbook: [../docs/STAGING.md](../docs/STAGING.md).

**Cloud Run:** container build from repo root, migrations at startup — [../docs/DEPLOYMENT_CLOUD_RUN.md](../docs/DEPLOYMENT_CLOUD_RUN.md).

**Local JSON first:** Steward changes often land in `data/ngos/*.json` (e.g. `npm run import:registry` from repo root — see [../data/ngos/imports/README.md](../data/ngos/imports/README.md)). Run `npm run validate` and `npm run build:data` there, then `cd server && npm run db:seed` (or your publish path) so Postgres mirrors the bundle.

See [../docs/PHASE_B_STACK.md](../docs/PHASE_B_STACK.md) and [../docs/LEGAL_NOTICE.md](../docs/LEGAL_NOTICE.md).
