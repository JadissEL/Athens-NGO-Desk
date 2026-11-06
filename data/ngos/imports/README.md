# National registry imports

Steward-prepared **JSON arrays** (or a single object `{ "organizations": [ ... ] }`) merge here into [`../athens_greece.json`](../athens_greece.json) with full schema parity (`jobOpenings` pending, `jobPossibility` unscored, plus a stub line in [`../job_possibility.json`](../job_possibility.json)).

## Format

File: JSON **array** of partial objects **or** `{ "organizations": [ ... ] }` (same rows).

| Field | Required | Notes |
|-------|----------|--------|
| `name` | yes | Display name |
| `nameEl` | no | Greek name if known |
| `sector` | no | Defaults to `Unknown / to categorise` |
| `scope` | no | Defaults to `Greece (steward: refine region)` |
| `focus` | no | Defaults to `— (steward: add programme focus)` |
| `website` | no | URL; host-only gets `https://` |
| `notes` | no | Free text |

**IDs:** The script assigns `ngo-<n>-<slug>`. For `n` 1–999 the numeric part is **zero-padded to 3 digits** (matches the seed); from **1000** onward the number is **unpadded** (e.g. `ngo-1000-my-org`) so it cannot collide with padded legacy IDs.

## Validate batch shape (optional)

```powershell
npm run validate:import -- data/ngos/imports/your_file.json
```

## Preview without writing (dry run)

```powershell
npm run import:registry -- --dry-run data/ngos/imports/your_file.json
```

Predicts new IDs and skipped rows and checks that the **merged** bundle would pass the full Ajv check — **no changes** to `athens_greece.json` or `job_possibility.json`.

## Run (apply)

From repo root (PowerShell):

```powershell
npm run import:registry -- data/ngos/imports/your_file.json
```

Then:

```powershell
npm run audit:registry-duplicates
npm run validate
npm run build:data
```

See [../../docs/DATA_PIPELINE.md](../../docs/DATA_PIPELINE.md) and [../../docs/NATIONAL_REGISTRY.md](../../docs/NATIONAL_REGISTRY.md).

Large lists: keep them **gitignored** here (`data/ngos/imports/*` except this README and `pending_national.example.json`).
