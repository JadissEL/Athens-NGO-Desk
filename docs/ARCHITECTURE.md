# Greece NGO Desk — repository layout

## Product audiences

The desk supports **multiple audiences** with the same underlying dataset: people exploring **jobs**, **funders** doing landscape research, **donors** choosing where to give, and **beneficiaries or referrers** who need orientation on **which NGO to contact** (always with clear limits — signposting, not professional advice or emergency response). Detail: [AUDIENCES.md](./AUDIENCES.md).

This project is organised as three clear layers:

| Layer | Location | Role |
|--------|----------|------|
| **Product (static UI)** | `static-site/` | HTML, CSS, JS; loads `data.js` as `window.NGO_DATA`. |
| **Canonical data** | `data/ngos/*.json` | Source of truth for registry, job research, emails, media digest, scores. |
| **Tools / pipeline** | `scripts/` | Merge research into JSON, **national import** (`import:registry`), extract from canvas, duplicate audit, bundle JSON → `static-site/data.js`. |
| **Phase B API** | `server/` | Fastify + Prisma + Postgres: `GET /api/ngo-data`, steward draft/publish, `AuditLog`. |

## Data flow

1. Edit or generate files under `data/ngos/` (or run merge/extract/import scripts that write there — **national batches:** [data/ngos/imports/README.md](../data/ngos/imports/README.md)).
2. Run `npm run validate` (recommended after imports) then `npm run build:data` to regenerate `static-site/data.js`.
3. Open `static-site/index.html` in a browser (or serve the folder).
4. Optional: deploy `server/`, run `prisma migrate deploy`, `npm run db:seed`, then consumers may use `GET /api/ngo-data` (same shape as `window.NGO_DATA`).

See [DATA_PIPELINE.md](./DATA_PIPELINE.md) for commands and file map, [NATIONAL_REGISTRY.md](./NATIONAL_REGISTRY.md) for expanding beyond the seed list with official registers and deduplication, [DATA_CONTRACT.md](./DATA_CONTRACT.md) for JSON shapes, [PHASE_B_STACK.md](./PHASE_B_STACK.md) for API/DB stack, [DEPLOYMENT_VERCEL_RENDER.md](./DEPLOYMENT_VERCEL_RENDER.md) for Vercel + Render + Clerk production hosting, [DEPLOY_PREVIEW.md](./DEPLOY_PREVIEW.md) for CI preview artifacts.
