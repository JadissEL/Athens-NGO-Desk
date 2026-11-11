# National coverage — 10 parallel agents × 3 phases

Scale the registry beyond the current curated set toward **definable Greek CSOs**, using **10 regional shards** and **three waves**. See [NATIONAL_REGISTRY.md](./NATIONAL_REGISTRY.md) for legal/source limits.

> **Note (2026-11-11):** Ten cloud research agents were launched in parallel but **stopped without writing shard files**. Use the **local pipeline** below (or re-run agents one shard at a time in foreground). First recovered data: **wave1_shard_03_crete.json** (+3 orgs).

## Phase 1 — Discover (add NGOs)

| Shard | Region | Output file |
|-------|--------|-------------|
| 01 | Attica | `wave1_shard_01_attica.json` |
| 02 | Central Macedonia | `wave1_shard_02_central_macedonia.json` |
| … | … | `wave1_shard_XX_<slug>.json` |
| 10 | National / multi-region | `wave1_shard_10_national.json` |

**Row shape:** [data/ngos/imports/README.md](../data/ngos/imports/README.md).

```powershell
npm run national:wave:status
node scripts/national/apply_wave1_imports.mjs --dry-run
npm run national:wave1:apply
npm run audit:registry-duplicates
npm run validate
npm run build:data
```

**Public list sources (examples):** [CretanSCENT](https://cretanscent.gr/index.php/el/ecosystem-el/oi-koinonikes-epixeiriseis) (Crete social enterprises), ΥΠΕΣ/okoip (broad Ο.Κοι.Π.) — steward export preferred over bulk scrape.

## Phase 2 — Org pages (registry enrichment)

Patch files: `wave2_profiles_shard_XX.json` → `npm run national:wave2:patch -- data/ngos/imports/...`

## Phase 3 — Jobs they publish

`wave3_jobs_shard_XX.json` → `npm run national:wave3:merge-jobs` → `npm run merge:jobs` → `npm run build:data`

## Shard map

[scripts/national/shards.json](../scripts/national/shards.json)

## Re-run agents safely

- **One shard per foreground task** (not 10 cloud agents at once).
- Each task must **write the JSON file** before ending.
- Then run `national:wave1:apply` from the repo root.
