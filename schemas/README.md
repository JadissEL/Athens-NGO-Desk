# JSON Schemas (`draft/2020-12`)

These files describe the shape of `data/ngos/*.json` consumed by `npm run build:data`.

| Data file | Schema |
|-----------|--------|
| `athens_greece.json` | `athens_greece.schema.json` |
| `job_possibility.json` | `job_possibility.schema.json` |
| `job_openings_summary.json` | `job_openings_summary.schema.json` |
| `spontaneous_emails.json` | `spontaneous_emails.schema.json` |
| `media_week.json` | `media_week.schema.json` |
| `job_research_seed.json` | `job_research_seed.schema.json` |
| *(steward import batches, not under `data/ngos/` by default)* | `registry_import_batch.schema.json` |

Validation runs in `scripts/validate_data_schemas.js` (Ajv). `build_data.js` fails if Schema validation fails.

**Merge input:** `npm run merge:jobs` validates `job_research_seed.json` first via `scripts/validate_job_research_seed.js`.

**National import:** `npm run import:registry` appends rows to `athens_greece.json` (and stubs in `job_possibility.json`) matching `athens_greece.schema.json`. Validate batch shape first: `npm run validate:import -- data/ngos/imports/your_batch.json`. Org `id` format: `ngo-<digits>-<slug>` (schema pattern `^ngo-[0-9]+-`). See `data/ngos/imports/README.md`.
