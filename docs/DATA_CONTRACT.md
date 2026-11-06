# Data contract (`window.NGO_DATA`)

`npm run build:data` produces `static-site/data.js`, which sets `window.NGO_DATA` to an object with these top-level keys.

**Strict validation:** Ajv applies the JSON Schemas in [`schemas/`](../schemas/) (see [`schemas/README.md`](../schemas/README.md)). The same checks run on `npm run validate` / `npm run validate:schemas`.

Below is a short human-readable summary; the `.schema.json` files are authoritative if this doc drifts.

## `registry` (from `athens_greece.json`)

- **Type:** object
- **Required:** `organizations` — array of NGO records (each is an object).
- **Used by UI:** `registry.organizations` for tables, filters, job listings.

## `possibility` (from `job_possibility.json`)

- **Type:** object
- **Optional for UI:** `organizations` — array (scores / bands). Missing array → UI treats as empty.

## `summary` (from `job_openings_summary.json`)

- **Type:** object
- **Required:** `meta` (object), `researched` (array).
- **Note:** Bundled for parity with the research pipeline; the current static UI does not read this key (safe to extend later).

## `emails` (from `spontaneous_emails.json`)

- **Type:** object
- **Required:** `meta` (object), `contacts` (array).

## `media` (from `media_week.json`)

- **Type:** object
- **Required:** `meta` (object), `articles` (array).

## Changing the contract

1. Update JSON under `data/ngos/`.
2. If the UI must consume new fields, edit `static-site/app.js`.
3. Update `scripts/build_data.js` (`validateBundle` / `inputs`) and this file so CI and docs stay aligned.
