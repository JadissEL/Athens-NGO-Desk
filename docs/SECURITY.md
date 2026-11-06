# Security notes

## Server (`server/`)

- **`@fastify/static`** — pinned to **10.1.10** to address known path handling advisories (keep updated).
- **`npm audit`** — remaining issues may come from **Prisma CLI** transitive `deepmerge-ts`; Prisma releases patch these on their cadence. Re-run `cd server && npm audit` after `npm update prisma`.

## Rate limiting

- `GET /api/ngo-data` uses `@fastify/rate-limit` (see `RATE_LIMIT_PUBLIC_*` in [server/.env.example](../server/.env.example)).

## Steward authentication

- **Clerk:** `CLERK_SECRET_KEY` on the API verifies session JWTs (`@clerk/backend` `verifyToken`). `CLERK_PUBLISHABLE_KEY` is exposed only via `GET /api/steward-config` for the static steward page — not a secret, but keep instance-scoped. Set `CLERK_AUTHORIZED_PARTIES` to your steward origin(s) so tokens cannot be replayed from unexpected frontends.
- **Generic JWT + JWKS** (`STEWARD_JWKS_URL`) remains supported for non-Clerk IdPs; rotate keys at the IdP.
- API keys (`STEWARD_API_KEYS`) are break-glass — store only in secret managers.

## Reporting

For responsible disclosure, contact the **maintainers** listed in the root [README.md](../README.md).
