# Greece NGO Desk — project tracker

## Summary

Greece NGO Desk: **static site** (`static-site/`) plus optional **Phase B API** (`server/`) that mirrors `window.NGO_DATA` in PostgreSQL. **Source JSON** remains in `data/ngos/`; **build** via `npm run build:data`; **steward** flows can sync to DB and export.

**Product intent:** serve **jobseekers**, **funders**, **donors**, and **people seeking NGO services** (signposting — not a crisis service); see [docs/AUDIENCES.md](docs/AUDIENCES.md).

## Architecture

- **Public UI:** static HTML/CSS/JS (`static-site/`, loads `window.NGO_DATA` from `data.js` or optional API fetch later).
- **Canonical JSON:** `data/ngos/*.json` + `schemas/*.schema.json` (Ajv).
- **Build:** `scripts/build_data.js` → `static-site/data.js`.
- **Phase B:** Fastify + Prisma + PostgreSQL — read-only `GET /api/ngo-data`, steward `PATCH` datasets + `POST /publish`, `AuditLog`. See `docs/PHASE_B_STACK.md`, `server/README.md`.

See `docs/ARCHITECTURE.md`, `docs/DATA_PIPELINE.md`, `docs/DEPLOYMENT_VERCEL_RENDER.md`, `docs/DEPLOYMENT_CLOUD_RUN.md`, `docs/METHODOLOGY.md`, `docs/LEGAL_NOTICE.md`, `docs/GOVERNANCE_RACI.md`, `docs/STAGING.md`, `docs/SECURITY.md`.

## Completed actions

| Date | Action |
|------|--------|
| 2026-11-07 | **Stitch A3 registry in code:** list-row NGO cards, org brief eyebrow, click card → sheet, single-match auto-open; `aegean-stitch3`. |
| 2026-11-07 | **Stitch A2 layout in code:** `stitch-layout.css` — job **list-row** cards + always-visible application panel; home trust strip; [docs/stitch/DESIGN.md](docs/stitch/DESIGN.md) + [STITCH_IMPLEMENTATION_CHECKLIST.md](docs/STITCH_IMPLEMENTATION_CHECKLIST.md); `aegean-stitch2`. |
| 2026-11-07 | **Stitch prompt pack:** [docs/STITCH_SCREEN_PROMPTS.md](docs/STITCH_SCREEN_PROMPTS.md) — §A1–A7 specific screens + §B1–B5 platform-wide; MCP generate blocked (auth). Paste in Stitch UI in order. |
| 2026-11-07 | **Stitch visual pass (interim):** `stitch-polish.css` + job/registry card caps; [docs/STITCH_SCREEN_PROMPTS.md](docs/STITCH_SCREEN_PROMPTS.md); cache `aegean-stitch1` · Stitch MCP auth blocked in-agent — regenerate screens in Stitch UI. |
| 2026-11-07 | **Cmd+K + registry typeahead:** mix7 — palette searches **pages, NGOs, openings** (NGO/Job badges → registry sheet / jobs pane); registry **q-reg** debounced pane focus (≥2 chars, desktop); `bento-mix7`. |
| 2026-11-07 | **Search → detail focus:** commit `b029d9a` — hero dock picks best registry/org or job match in pane; registry **Quick** presets open first result on desktop; stale sheet closes when filter drops selection; `bento-mix6`. |
| 2026-11-07 | **Jobs rail + guides polish:** commit `14287fb` — **Soon** deadline chips open detail pane (+ Apply ↗ link); selection scroll-into-view; possibility card clicks; Create/Fund step cards; `bento-mix5`. |
| 2026-11-07 | **Table + detail pane:** commit `67fd4cb` — jobs/registry **table inside split**; row click + highlight; drawer only on mobile; Vercel secrets table in deploy doc; `bento-mix4`. |
| 2026-11-07 | **Workbench master–detail (desktop):** commit `19caf5b` — jobs **split pane** (card list + sticky detail; drawer on mobile), registry **side sheet** in grid, selected-card chrome, Life **guide-day** cards; cache `bento-mix3`. |
| 2026-11-07 | **Bento card system (site-wide):** commit `524aa5c` — registry/jobs **Cards↔Table** toggles, **job detail drawer**, apply/media/possibility **ngo-card** grids, org profile **HR split** (identity aside + tabbed folds), guide panels card surfaces; live **GitHub Pages** (`bento-mix2` cache busters). |
| 2026-11-07 | **Stitch + platform UX (v2 shipped):** commit `f03d64f` —  workbench **280px filter rails** (registry/jobs), **sticky scroll tables**, org profile **accordion folds** + sticky aside, **mobile dock** (&lt;768px only), platform content width on long-form pages, primary button + chip critic pass. Stitch project `14677559256789528548` (screens may finish async in UI). |
| 2026-11-07 | **Stitch + platform UX rework (v1):** Google Stitch project **Greece NGO Desk** (`14677559256789528548`) + design system **Aegean Civic Craft**; static site **desktop-first platform shell** — grouped nav (Discover / Work / Guides), `#audiences` + `#legal` pages (Vercel-safe), home stats + audience cards, org breadcrumbs, **Ctrl+K** command palette, inner pages without hero photo noise; tokens Playfair + Manrope + teal/terracotta. |
| 2026-11-07 | **Greece-only branding:** product/Render resource names **`greece-ngo-desk-*`**; legacy **`athens-ngo-desk-*`** renamed in Render; npm packages `greece-ngo-desk`; UI copy “Greece NGO Desk” only (Athens remains a **geo filter**, not a product name). **Note:** Render `.onrender.com` slug may stay `athens-ngo-desk-api` until custom domain or new service. |
| 2026-11-06 | **Render prod live:** `DATABASE_URL` via provision script; fixed `ajv/dist/2020` (`createRequire(server/package.json)` in `validate_data_schemas.js`); provision script **PATCH**es existing services (`rootDir=server`, build includes `seed_from_json.ts --if-empty`, `/api/health`). Smoke: **200** on `/api/health`, `/api/ready`, `/api/ngo-data` (~497 KB). |
| 2026-11-06 | **Render — zero-dashboard provision:** defaults to **elantaki.dijadiss@gmail.com** workspace + names `athens-ngo-desk-db` / `athens-ngo-desk-api`; `scripts/render_provision_api.mjs` + workflow `render-provision-api.yml` (secret `RENDER_API_KEY`). |
| 2026-11-06 | **Render — second account (API):** `scripts/render_provision_api.ps1` + deploy doc section: creates Postgres + web service via Render API when `RENDER_API_KEY` is set for that workspace (MCP cannot act as another Render user). |
| 2026-11-06 | **Google Cloud Run:** root `Dockerfile` + `server/docker-entrypoint.sh` (`prisma migrate deploy` then `node dist/index.js`); `prisma` moved to runtime deps for migrate in prod image; `docs/DEPLOYMENT_CLOUD_RUN.md` (build/push, env, seed once). |
| 2026-11-06 | **Render deploy fix:** `render.yaml` wires `DATABASE_URL` from Postgres `athens-ngo-desk-db` via `fromDatabase`; build runs `seed_from_json.ts --if-empty` after compile. **Static site:** `static-site/index.html` sets `NGO_DATA_API_BASE` to `https://athens-ngo-desk-api.onrender.com`. **Note:** manual web services must **link DB** in the dashboard or use a synced Blueprint — `render.yaml` alone does not update env on an existing manual service. |
| 2026-11-06 | **Production deploy guide:** `docs/DEPLOYMENT_VERCEL_RENDER.md` (Vercel `static-site/` + Render `server/` + Clerk); `render.yaml` blueprint; `static-site/vercel.json`; `docs/STAGING.md` fix: `NGO_DATA_API_BASE` (was wrong name). |
| 2026-11-06 | **Standalone git + GitHub:** repository root fixed to this folder (`git init`); initial commit; public remote **[github.com/JadissEL/Athens-NGO-Desk](https://github.com/JadissEL/Athens-NGO-Desk)** (`gh repo create` + push `main`). Prior issue: user-level git had treated **home directory** as repo root — do not use `git status` from `~` for this project. |
| 2026-11-06 | **OSINT profile enrichment (desk-held):** `merge_osint_into_registry` ingests `job_possibility` (URLs + text) + `media_week` (fuzzy match + aliases) into `osintProfile.references` + `deskCorpus`; UI section **Desk corpus & digest**; schema `deskCorpus` + `osintMediaDigestMatch`. |
| 2026-11-06 | **OSINT merge v2:** stronger media matching (acronyms from parentheses, single-token hits for long tokens), expanded `ORG_ALIAS_TOKENS`, `references[]` from each `jobOpenings.postings[].url` + URLs in notes/why; `identity.aliases` populated; mission row **Also known as (desk)** in org profile UI. |
| 2026-11-06 | **OSINT merge v3:** `spontaneous_emails.json` **applyUrl** + note URLs → `references[]`; build/validate/API pass `emails` into merge; `npm run osint:coverage` → `osint_coverage_report.json` (gitignored). |
| 2026-11-06 | **OSINT merge v4:** `references[]` from registry **website** + **careersUrl** + normalised **sources** + posting **notes**; `possibility.why` URLs; `job_openings_summary.researched[].careersUrl`; `employmentSignals.discoverySourceUrls`; `summary` passed into merge (build/validate/API/report). |
| 2026-11-06 | **OSINT merge v5:** stricter digest matching (stopwords, word boundaries, slug + domain tokens); extra digest **body/dek** URLs → `references[]`; URL dedupe normalisation; `scaleSignals` backfilled from `job_possibility.json` when registry sparse; org profile **references** grouped by type in UI. |
| 2026-11-06 | **OSINT merge v6:** `onlinePresence.contactHints` from all **`spontaneous_emails`** rows per org; org profile Quick links show email + ATS rows; **`osint:coverage`** prints top **steward hints** for thin orgs + per-org hint lists; not-found profile clears programmes/refs. |
| 2026-11-06 | **Registry / Openings UX:** progressive disclosure (`discover-panel`), region buckets + quick presets, advanced filters in `<details>`; jobs: Where + thematic sector; table column **Region** (abbr + full scope on hover). |
| 2026-11-06 | **Per-organisation OSINT profile pages:** hash routes `#org/<id>`, merged `osintProfile` at build + on `GET /api/ngo-data` / publish (optional `data/ngos/osint_profiles.json` overrides); registry + openings link to profile; schema `schemas/athens_greece.schema.json` + `schemas/osint_profiles.schema.json`; docs `docs/METHODOLOGY.md` (OSINT section), `docs/DATA_PIPELINE.md`. |
| 2026-11-06 | Restructured repo: `data/ngos/`, `docs/`, `package.json`, `scripts/build_data.js`, GitHub Action `validate-data.yml`; removed `data-ngos-json/` folder name. |
| 2026-11-06 | Build-time structural validation in `build_data.js`; `docs/DATA_CONTRACT.md`; `NGO_DESK_CANVAS_PATH` for extract script; `engines.node` in `package.json`. |
| 2026-11-06 | JSON Schema + Ajv: `schemas/*.schema.json`, `scripts/validate_data_schemas.js`; CI uses `npm ci`; `npm run validate` runs schema-only check. |
| 2026-11-06 | Phase B: Fastify + Prisma + Postgres (`server/`), `GET /api/ngo-data`, steward `/steward/` + PATCH/publish with Ajv gate, `AuditLog`, `docker-compose`, CI `server.yml` + `preview-build` artifacts, `docs/METHODOLOGY.md`, `LEGAL_NOTICE.md`, `GOVERNANCE_RACI.md`, `PHASE_B_STACK.md`, `DEPLOY_PREVIEW.md`. |
| 2026-11-06 | Next-steps plan: `docs/STAGING.md`, static `data_loader.js` + API fetch, `export_from_api.js`, `smoke_api.js`, `job_research_seed.schema.json`, JWT/JWKS steward auth + rate limit + `/api/ready`, `@fastify/static@10.1.10`, `docs/SECURITY.md`, README maintainer contact, RACI named placeholders, CI `validate:seed`. |
| 2026-11-06 | **Greece-wide positioning:** user-facing **Greece NGO Desk** branding; registry `meta.title` + docs; openings default **All Greece** with optional Athens/Attica filter; `static-site/data.js` rebuilt. |
| 2026-11-06 | **Multi-audience scope:** documented jobseekers + funders + donors + service seekers in `docs/AUDIENCES.md`, README, tracker, architecture; home line updated (signposting, not emergency advice). |
| 2026-11-06 | **National registry plan:** `docs/NATIONAL_REGISTRY.md` (ΥΠΕΣ okoip + migration registry; dedupe rules); `npm run audit:registry-duplicates` + `scripts/audit_registry_duplicates.js`. |
| 2026-11-06 | **Migration NGO registry URL refresh:** canonical **[okeanis.migration.gov.gr](https://okeanis.migration.gov.gr/)** in `docs/NATIONAL_REGISTRY.md` + `static-site/index.html` (legacy `registered.php` superseded); Okeanis doc note (SPA + Keycloak; no assumed public bulk API); `.gitignore` for local recon samples under `scripts/.`. |
| 2026-11-06 | **National import parity:** `schemas/athens_greece.schema.json` + `schemas/osint_profiles.schema.json` org `id` pattern `^ngo-[0-9]+-` (>999 orgs); `scripts/import_registry_rows.js` + `scripts/registry_dedupe_utils.js` (shared with `audit_registry_duplicates.js`); `npm run import:registry`; `data/ngos/imports/` README + example; `.gitignore` for large batches under `imports/`; docs `docs/DATA_PIPELINE.md`, `docs/NATIONAL_REGISTRY.md`, `data/ngos/README.md`. |
| 2026-11-06 | **Sync static bundle:** `npm run build:data` regenerated `static-site/data.js` from canonical JSON (104 orgs); README / `static-site/README.md` / `schemas/README.md` cite national import workflow. |
| 2026-11-06 | **Docs — national import cross-links:** `docs/ARCHITECTURE.md` pipeline table + data-flow; `README.txt` bundle commands; `server/README.md` note to import/validate/seed before API mirrors JSON. |
| 2026-11-06 | **Import script hardening:** `import_registry_rows.js` accepts `{ "organizations": [...] }`; new IDs use unpadded numbers from 1000+ (avoids collision with zero-padded legacy); docs in `data/ngos/imports/README.md` + `DATA_PIPELINE.md`. |
| 2026-11-06 | **Import preview + batch schema:** `npm run validate:import` (`schemas/registry_import_batch.schema.json`); `import:registry -- --dry-run` (merged bundle Ajv, no writes); CI validates example batch; `generateAutoOsintProfile` TDZ fix + `osintProfile.references` added to schema required list. |

## Modified / added (2026-11-06)

- Added: `data/ngos/` (moved from `data-ngos-json/`), `docs/ARCHITECTURE.md`, `docs/DATA_PIPELINE.md`, `docs/DATA_CONTRACT.md`, `schemas/`, `scripts/build_data.js`, `scripts/validate_data_schemas.js`, `package.json`, `package-lock.json`, `.github/workflows/validate-data.yml`, root `README.md`
- Updated: `README.txt`, `static-site/README.md`, `static-site/data.js` (regenerated), `scripts/extract_ngos_from_canvas.js`, `docs/NATIONAL_REGISTRY.md`, `docs/ARCHITECTURE.md`, `static-site/index.html`, `.gitignore`, `schemas/athens_greece.schema.json`, `schemas/osint_profiles.schema.json`, `schemas/registry_import_batch.schema.json`, `schemas/README.md`, `scripts/audit_registry_duplicates.js`, `scripts/import_registry_rows.js`, `scripts/validate_registry_import.js`, `scripts/merge_osint_into_registry.js`, `scripts/registry_dedupe_utils.js`, `package.json`, `docs/DATA_PIPELINE.md`, `data/ngos/README.md`, `data/ngos/imports/README.md`, root `README.md`, `server/README.md`, `.github/workflows/validate-data.yml`

## Open decisions

- Whether to commit `.cursor_memory/` for team sharing (currently gitignored).

## Recent (Clerk steward)

| Date | Action |
|------|--------|
| 2026-11-06 | Steward auth: **Clerk** via `@clerk/backend` `verifyToken` when `CLERK_SECRET_KEY` or `CLERK_JWT_KEY` is set; `/api/steward-config`; steward UI loads Clerk from CDN and sends session JWT; env documented in `server/.env.example`. |

## Phase B (2026-11-06)

| Component | Details |
|-----------|---------|
| Stack | Fastify 5 + Prisma 6 + PostgreSQL — see [docs/PHASE_B_STACK.md](docs/PHASE_B_STACK.md) |
| API | `GET /api/ngo-data` (public), `GET/PATCH /api/draft`, `POST /api/publish`, `GET /api/audit` — [server/README.md](server/README.md) |
| Steward UI | [server/public/steward/index.html](server/public/steward/index.html) |
| Audit | `AuditLog` table + masked key fingerprint in `actorKey` |
| CI | [`.github/workflows/server.yml`](.github/workflows/server.yml) typecheck; [`.github/workflows/preview-build.yml`](.github/workflows/preview-build.yml) artifacts |
| Local DB | [docker-compose.yml](docker-compose.yml) |

## Registered prompts

### 2026-11-06 — OSINT org pages

- **Ask:** Build a page per NGO with logos and full online (OSINT) information.
- **Outcome:** Auto-synthesized `osintProfile` merged at build/API time; UI at `#org/<id>` with methodology, employment signals, optional Clearbit-derived logo when website known; optional richer data via `osint_profiles.json`.

### 2026-11-06 — Restructure project

- **Ask:** Restructure the project based on prior R&D organisation thinking.
- **Outcome:** Data → `data/ngos/`, documented pipeline, npm scripts, CI validation.

### 2026-11-06 — Continue (pipeline hardening)

- **Ask:** Continue.
- **Outcome:** `build_data.js` validates NGO_DATA shape; `DATA_CONTRACT.md`; canvas extract supports `NGO_DESK_CANVAS_PATH`; `engines` in `package.json`.

### 2026-11-06 — JSON Schema (T1)

- **Ask:** Continue.
- **Outcome:** Ajv + `schemas/*.schema.json`; `validate_data_schemas.js`; `npm run validate` / `validate:schemas`; CI runs `npm ci` before build.

### 2026-11-06 — Continue official registry search

- **Ask:** Continue the search on official sources and how to ingest/dedupe at scale.
- **Outcome:** Okeanis documented as the live Migration Μητρώο ΜΚΟ entry point; links and national-registry strategy updated; ingestion note: Keycloak-backed portal — prefer okoip + steward merge or official export over unattended scraping.

### 2026-11-06 — National NGO import (full schema parity)

- **Ask:** Implement steward import so new national rows match existing registry shape.
- **Outcome:** `import:registry` merges JSON batches with `jobOpenings`/`jobPossibility` defaults + `job_possibility.json` stubs; relaxed `ngo-<digits>-` ID schema; dedupe utils shared with duplicate audit; documented in `DATA_PIPELINE` / `NATIONAL_REGISTRY` / `data/ngos/imports`.

### 2026-11-06 — Continue national import task

- **Ask:** Continue on the last task.
- **Outcome:** Regenerated `static-site/data.js` from canonical JSON; added import workflow lines to root `README.md`, `static-site/README.md`, `schemas/README.md`.

### 2026-11-06 — Continue (docs cross-links)

- **Ask:** Continue.
- **Outcome:** `docs/ARCHITECTURE.md`, `README.txt`, `server/README.md` aligned with `import:registry` / validate / seed workflow.

### 2026-11-06 — Continue (import envelopes + IDs)

- **Ask:** Continue.
- **Outcome:** Import accepts wrapped `organizations` array; sequential IDs ≥1000 unpadded in the numeric segment; import README + pipeline doc updated.

### 2026-11-06 — Continue (dry-run, validate:import, OSINT schema fix)

- **Ask:** You can do more.
- **Outcome:** `validate:import`, `--dry-run`, `registry_import_batch.schema.json`, CI step; fixed `merge_osint_into_registry.js` confidence block + `osintProfile.references` required in `athens_greece.schema.json`.
