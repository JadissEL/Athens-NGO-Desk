# Data pipeline

## Canonical inputs (`data/ngos/`)

| File | Purpose |
|------|---------|
| `athens_greece.json` | Master NGO registry + `jobOpenings` per org |
| `imports/` | Steward JSON batches for national rows (see `imports/README.md`; large files gitignored) |
| `job_research_seed.json` | Raw research payloads merged into the registry |
| `job_openings_summary.json` | Compact view of researched orgs (generated/updated by merge) |
| `job_possibility.json` | Job-finding possibility scores |
| `spontaneous_emails.json` | Spontaneous candidature contacts |
| `media_week.json` | Weekly media digest |
| `osint_profiles.json` | **Optional** overrides merged into each org’s `osintProfile` at build/API time (see [METHODOLOGY.md](./METHODOLOGY.md#osint-profiles-public-sources)) |

## Build artefact

`npm run build:data` reads the files above, **merges auto-generated `osintProfile` blobs** (and optional `osint_profiles.json` overrides) into `registry.organizations[]`, then writes:

- `static-site/data.js` — `window.NGO_DATA = { registry, possibility, summary, emails, media }`

## Commands (from repo root)

```powershell
npm run merge:jobs
npm run build:data
npm run audit:registry-duplicates   # duplicate host / name report -> data/ngos/registry_duplicate_report.json
npm run osint:coverage             # tier + thin-org steward hints -> data/ngos/osint_coverage_report.json (gitignored)
```

### National import (full schema parity)

Merge a JSON **array** of partial organisations into `athens_greece.json` with required `jobOpenings` / `jobPossibility` defaults and matching stubs in `job_possibility.json`:

```powershell
npm run validate:import -- data/ngos/imports/your_batch.json
npm run import:registry -- --dry-run data/ngos/imports/your_batch.json
npm run import:registry -- data/ngos/imports/your_batch.json
npm run audit:registry-duplicates
npm run validate
npm run build:data
```

Format and fields: [data/ngos/imports/README.md](../data/ngos/imports/README.md) — array **or** `{ "organizations": [...] }`. Batch shape schema: [`schemas/registry_import_batch.schema.json`](../schemas/registry_import_batch.schema.json). The import script validates the **merged** bundle with Ajv (`--dry-run` does the same without writing); duplicates (same website host or same normalised name as an existing org) are **skipped** and logged.

National expansion strategy (official registers, dedupe rules): [NATIONAL_REGISTRY.md](./NATIONAL_REGISTRY.md).

**Extract registry from Cursor canvas** — default path targets one machine’s Cursor project layout. Override with:

```powershell
$env:NGO_DESK_CANVAS_PATH = "C:\path\to\athens-greece-ngos.canvas.tsx"
node scripts/extract_ngos_from_canvas.js
```

See [DATA_CONTRACT.md](./DATA_CONTRACT.md) for the shape `build:data` enforces.

## CI

On pull requests and pushes, `.github/workflows/validate-data.yml` runs `npm ci`, `npm run validate`, `npm run validate:seed`, and `npm run build:data`.

Pull requests also run **Preview build** (`.github/workflows/preview-build.yml`) uploading `static-site` and compiled `server` as workflow artifacts ([DEPLOY_PREVIEW.md](./DEPLOY_PREVIEW.md)). Pushes that touch `server/**` run **Server build** typecheck (`.github/workflows/server.yml`).

## Phase B sync (optional)

After editing JSON, you can load the same bundle into Postgres:

```powershell
docker compose up -d postgres
$env:DATABASE_URL="postgresql://desk:desk@127.0.0.1:5432/athens_ngo_desk"
cd server
npx prisma migrate deploy
npm run db:seed
```

See [../server/README.md](../server/README.md).

## Export published API → repo JSON (reverse sync)

From repo root (point at your deployed API):

```powershell
$env:NGO_DESK_API_BASE="https://your-api.example.com"
npm run export:api
# optionally regenerate static-site/data.js:
npm run export:api -- --build
```

## Static site: optional live API

1. Host the Phase B API with CORS allowing your static origin.
2. In [static-site/index.html](../static-site/index.html), set `window.NGO_DATA_API_BASE = "https://your-api.example.com"` (before `data_loader.js`).
3. [data_loader.js](../static-site/data_loader.js) fetches `/api/ngo-data` and [app.js](../static-site/app.js) prefers it over `data.js`.

## Smoke test (CI or local)

```powershell
$env:NGO_DESK_API_BASE="http://127.0.0.1:4000"
npm run smoke:api
```

Staging runbook: [STAGING.md](./STAGING.md).

## JSON Schema only (no write)

```powershell
npm run validate:schemas
```
