# Preview deployments

## CI artifacts

Workflow **Preview build** (`.github/workflows/preview-build.yml`) uploads on each PR:

- **`static-site-preview`** — `static-site/` including generated `data.js` (host on any static host or GitHub Pages).
- **`server-preview`** — compiled `server/dist`, `server/prisma`, and lockfile (deploy to Fly.io / Render / Azure with `DATABASE_URL`).

## Manual preview (local)

```powershell
docker compose up -d postgres
$env:DATABASE_URL="postgresql://desk:desk@127.0.0.1:5432/athens_ngo_desk"
$env:STEWARD_API_KEYS="local-dev-key"
cd server
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- Public API: `http://127.0.0.1:4000/api/ngo-data`
- Steward: `http://127.0.0.1:4000/steward/`

## Production

- Choose **EU** Postgres; configure secrets per host (see [PHASE_B_STACK.md](./PHASE_B_STACK.md)).
