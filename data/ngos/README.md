# Greece NGO data (`data/ngos/`)

Canonical JSON for the desk. The static site does not read these files directly — run `npm run build:data` from the repo root to regenerate `static-site/data.js`. Shapes are summarised in `docs/DATA_CONTRACT.md` and enforced by `schemas/*.schema.json` (Ajv).

| File | Purpose |
|------|---------|
| `athens_greece.json` | Master registry of 104 NGOs (Greece-wide; filename is legacy) + `jobOpenings` per org |
| `imports/` | Steward batches for national expansion (`npm run import:registry`) — see `imports/README.md` |
| `job_research_seed.json` | Raw research payloads merged into the registry |
| `job_openings_summary.json` | Compact view of orgs already researched (counts + dates) |
| `job_possibility.json` | Job-finding possibility scores |
| `spontaneous_emails.json` | Spontaneous candidature contacts |
| `media_week.json` | Weekly media digest |
| *(generated)* `registry_duplicate_report.json` | Local output of `npm run audit:registry-duplicates` (gitignored) |

## Scripts (from repo root)

```powershell
node scripts/extract_ngos_from_canvas.js   # rebuild registry skeleton from canvas
npm run merge:jobs                       # apply job_research_seed.json
npm run build:data                       # bundle JSON -> static-site/data.js
npm run audit:registry-duplicates        # host / name duplicate audit
```

Growing beyond the initial Athens-heavy seed: [../docs/NATIONAL_REGISTRY.md](../docs/NATIONAL_REGISTRY.md).

## Job openings caveat

Counts and dates come from **public** careers pages, ATS boards, and LinkedIn discovery. They are **not** a complete historical census of every vacancy each NGO has ever published. Orgs still marked `jobOpenings.status: pending` need a later research pass.
