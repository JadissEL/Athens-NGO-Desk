# Staging deployment (EU-oriented)

This checklist is runbook-style: it does **not** provision cloud resources for you; it lists what to set for a **staging** environment before production.

## 1. PostgreSQL (EU region)

- Create a Postgres 15+ instance in an **EU** region (e.g. Neon `eu-central-1`, Azure `Germany West Central`, AWS `eu-central-1`).
- Copy the **pooled** connection string into `DATABASE_URL` on the API host.
- Run migrations from `server/`:

```bash
cd server && npx prisma migrate deploy
```

## 2. API host

- Deploy the Node app (`npm run build && npm start` in `server/`) or run `npm run dev` behind TLS in dev only.
- Set environment variables (see [server/.env.example](../server/.env.example)):

| Variable | Staging value |
|----------|----------------|
| `DATABASE_URL` | EU Postgres URL |
| `CORS_ORIGIN` | Your static-site origin (e.g. `https://desk-staging.example.com`) — not `*` if cookies matter later |
| `CLERK_SECRET_KEY` | Clerk Dashboard API key (server verifies steward JWTs) |
| `CLERK_PUBLISHABLE_KEY` | Publishable key (served to `/steward/` via `/api/steward-config`) |
| `CLERK_AUTHORIZED_PARTIES` | Comma-separated origins allowed to mint session tokens (include API origin if steward is same host) |
| `STEWARD_API_KEYS` | Optional break-glass key(s) |
| `STEWARD_JWT_SECRET` or `STEWARD_JWKS_URL` | Optional generic JWT path; see [server/README.md](../server/README.md) |

## 3. Smoke test

From any machine:

```bash
curl -fsS "$API_URL/api/health"
curl -fsS "$API_URL/api/ready"
curl -fsS "$API_URL/api/ngo-data" | head -c 200
```

Steward flow (replace key):

```bash
curl -fsS -H "Authorization: Bearer $KEY" "$API_URL/api/draft" | head -c 200
```

## 4. Static site

- Host `static-site/` on static hosting.
- Set `window.NGO_DATA_API_URL` to the **API base** (no trailing slash) so [static-site/app.js](../static-site/app.js) can fetch `/api/ngo-data` — see [DATA_PIPELINE.md](./DATA_PIPELINE.md).

## 5. Secrets

- Never commit `.env`. Use the host’s secret store.
- Rotate `STEWARD_API_KEYS` if exposed; review `AuditLog` after incidents.
