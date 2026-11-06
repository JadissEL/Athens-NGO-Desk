# National NGO coverage (Greece) — strategy

## Reality check

There is **no single export** that equals “every organisation people call an NGO in Greece.” The universe includes:

- **Ο.Κοι.Π. / “ΜΚΟ” in the legal sense** — σωματεία, ΑΜΚΕ, ιδρύματα, επιτροπές εράνων, registered in **ΥΠΕΣ** systems (**[okoip.gov.gr](https://okoip.gov.gr/CSOIS/)** — public database + special register; see also [ΥΠΕΣ — Ο.Κοι.Π.](https://www.ypes.gr/diefthynsi-organoseon-koinonias-ton-politon-o-koi-p-kai-koinofelon-foreon/)).
- **Sector-specific national lists** — e.g. [Migration Ministry — Μητρώο ΜΚΟ (Okeanis)](https://okeanis.migration.gov.gr/) (NGOs active in **asylum/migration** programmes; subset of all CSOs).
- **Foundations, informal groups, INGO branches** — may appear under different legal names or only on ΓΕΜΗ / corporate sites.

Parliamentary answers have cited **very large** counts of historical “ΜΚΟ” labels versus **registered** Ο.Κοι.Π. in the new databases — so “all NGOs” must be defined by **which register** you import.

**This desk does not automatically pull the full national register yet.** The JSON registry (`data/ngos/athens_greece.json`) is **curated** and must be **grown in waves** from authoritative sources.

### Migration Ministry — Okeanis (URL + ingestion note)

The old public URL **`https://ngo.migration.gov.gr/registered.php`** no longer serves a list; it **redirects** to a short landing page that sends users to the current system.

| Item | Detail |
|------|--------|
| **Canonical public entry** | **[https://okeanis.migration.gov.gr/](https://okeanis.migration.gov.gr/)** — “Μητρώο ΜΚΟ” (Υπουργείο Μετανάστευσης & Ασύλου). |
| **UI shape (checked 2026-11)** | Single-page app: `index.html` loads hashed `/assets/index-*.js` + `/assets/index-*.css` (standard React/Vite-style build). |
| **Auth** | The shipped JavaScript bundle includes **Keycloak** — the product is oriented to **authenticated portals** (applications, renewals, document flows), not a static HTML table of all registered NGOs. |
| **Bulk import** | Do **not** assume a public REST list is available for unattended scraping. Prefer: **ΥΠΕΣ / okoip** as the broad public register → **merge** migration-sector orgs via **steward-curated** rows, **official export**, or a **written data-sharing agreement** with the ministry. |

For merge order, still treat this register as **wave 2** (after okoip), keyed by website host and normalised name as in [De-duplication rules](#de-duplication-rules-mandatory) below.

### Importing new rows (steward JSON)

When adding orgs from official research or exports, use **`npm run import:registry`** so each row matches [`schemas/athens_greece.schema.json`](./../schemas/athens_greece.schema.json) (identity fields + `jobOpenings` pending + `jobPossibility` unscored) and appends a sibling line to **`job_possibility.json`** (`possibility: "Unmeasured"`, `score: null`). See [data/ngos/imports/README.md](../data/ngos/imports/README.md) and [DATA_PIPELINE.md](./DATA_PIPELINE.md) (national import section).

## De-duplication rules (mandatory)

When merging any new list:

1. **Primary key:** normalised **website hostname** (strip `www.`, scheme, path). One host → one org row unless you have evidence of separate legal entities sharing a domain (rare).
2. **Secondary:** normalised **legal / display name** (Unicode-fold Greek, collapse whitespace). Flag if two rows share a name but different hosts — manual merge.
3. **Tertiary:** official **registry IDs** when present (Ο.Κοι.Π. ID, ΑΦΜ if you store it in a steward-only field later, migration registry id).
4. **Never** duplicate because of alternate spellings (“NGO” vs “N.G.O.”, Greek/English name variants) — merge into one record with `name` + `nameEl`.

Run a duplicate audit on the current file:

```powershell
npm run audit:registry-duplicates
```

Output: `data/ngos/registry_duplicate_report.json` plus console summary.

## Suggested import order

| Wave | Source | Notes |
|------|--------|--------|
| 1 | **ΥΠΕΣ / okoip** public search | Broadest “Ο.Κοι.Π.” coverage; respect [LEGAL_NOTICE](./LEGAL_NOTICE.md) on reuse. |
| 2 | **Migration Ministry — [Okeanis](https://okeanis.migration.gov.gr/)** | Add/split migration-focused orgs; merge with okoip rows on website or name. Expect **no public bulk API**; steward merge or official export. |
| 3 | **Regional / thematic** (environment, disability, …) | Only after core national merge; still dedupe on host + name. |

## Schema / pipeline

- New org rows must satisfy `schemas/athens_greece.schema.json` (`jobOpenings` + `jobPossibility` defaults for unresearched orgs).
- Use `npm run build:data` after bulk edits; CI runs `npm run validate`.

## Related

- [DATA_PIPELINE.md](./DATA_PIPELINE.md) — build commands.
- [AUDIENCES.md](./AUDIENCES.md) — who the registry serves.
- [LEGAL_NOTICE.md](./LEGAL_NOTICE.md) — disclaimers and data handling.
