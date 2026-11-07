# Greece NGO Desk

Static site and JSON-backed data for **Greece-wide** civil-society orientation: registry, openings, spontaneous application contacts, and weekly media digest. **Audiences are intentionally broad** — not only job researchers, but also **funders**, **donors**, and **people looking for services** who need help choosing which organisation to contact (signposting only; see [docs/AUDIENCES.md](docs/AUDIENCES.md) and [docs/LEGAL_NOTICE.md](docs/LEGAL_NOTICE.md)). Athens remains a common HQ hub in the dataset, not the geographic limit of the product.

## Maintainers / takedown

For **corrections, removals, or data handling requests**, email **desk@example.org** and replace it with your real contact when you operate a public instance. See [docs/LEGAL_NOTICE.md](docs/LEGAL_NOTICE.md).

## Layout

- **`static-site/`** — UI (`index.html`, `styles.css`, `app.js`, `data.js`)
- **`data/ngos/`** — Canonical JSON inputs (registry, jobs, emails, media)
- **`scripts/`** — Merge, extract, and `build_data.js` (bundles JSON → `data.js`)
- **`server/`** — Phase B API + steward UI (`server/README.md`)
- **`docs/`** — [Architecture](./docs/ARCHITECTURE.md), [audiences](./docs/AUDIENCES.md), [national registry](./docs/NATIONAL_REGISTRY.md), [pipeline](./docs/DATA_PIPELINE.md), **production deploy (Vercel + Render + Clerk)** [DEPLOYMENT_VERCEL_RENDER.md](./docs/DEPLOYMENT_VERCEL_RENDER.md), [contract](./docs/DATA_CONTRACT.md), [methodology](./docs/METHODOLOGY.md), [legal](./docs/LEGAL_NOTICE.md), [RACI](./docs/GOVERNANCE_RACI.md), [deploy preview](./docs/DEPLOY_PREVIEW.md), [staging](./docs/STAGING.md), [security](./docs/SECURITY.md)
- **`schemas/`** — JSON Schema definitions for `data/ngos/` (Ajv validation on build)

## Quick start

```powershell
cd path\to\Greece-NGO-Desk-project
npm ci
npm run build:data
Start-Process (Resolve-Path "static-site\index.html").Path
```

After editing anything under `data/ngos/`, run `npm run build:data` again.

**Add national org rows (steward JSON):** `npm run validate:import -- data/ngos/imports/your_batch.json`, optional `npm run import:registry -- --dry-run data/ngos/imports/your_batch.json`, then `npm run import:registry -- …`, `npm run audit:registry-duplicates`, `npm run validate`, `npm run build:data`. See [data/ngos/imports/README.md](data/ngos/imports/README.md).

## This folder

This tree may be a **standalone copy** from another repo (see `README.txt` for bundle notes). Paths and scripts here assume this layout.
