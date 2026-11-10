# Methodology — scores, statistics, and limitations

This document governs how **quantitative** claims on the Greece NGO Desk may be described in product copy and datasets.

## Job-finding “possibility” score (`job_possibility.json`)

- **What it is:** A **relative index** (roughly 0–100) combining public vacancy signals and crude scale proxies (staff, beneficiaries). It is **not** a probability of receiving an offer.
- **Weights (design intent):** hiring/recency activity, organisation scale, programme scale — exact blend is documented in `job_possibility.json` → `meta.method` when present.
- **Uncertainty:** Organisations with `pending` or sparse research carry **high epistemic uncertainty**. The UI should prefer labels (“High / Medium / Low”) over two-decimal precision unless sample size is documented.
- **Econometric note:** This is **not** a causal estimate of employment probability. Confounding includes geography, language, licence requirements, and unobserved hiring channels (referrals, closed calls).

## Job openings counts (`athens_greece.json` → `jobOpenings`)

- **Source:** Public careers pages, ATS listings, and partial board discovery — **not** exhaustive historical HR records.
- **Reporting bias:** Large INGOs with Workday/Greenhouse may appear under- or over-represented vs small Greek NGOs with only PDF calls.

## Media digest (`media_week.json`)

- **Nature:** Editorial **summaries** with links to primary sources — not a verbatim syndication. Dates and claims must be checked on the source URL.

## Actuarial / stochastic framing (future)

If **event-level** data (vacancy observed at time *t*) is stored:

- Prefer **hazard / survival** language only with a **minimum event count** per stratum.
- Disclose **right-censoring** (roles filled without public delisting) and **selection bias**.

## OSINT profiles (public sources)

Each organisation can carry an **`osintProfile`** object (merged at **build time** and on **`GET /api/ngo-data`** / publish), describing what the desk holds from **open sources** only.

- **Canonical JSON on disk** (`data/ngos/athens_greece.json`) does **not** need to store `osintProfile`; the build synthesizes it from registry fields + job research, then applies optional overrides from `data/ngos/osint_profiles.json`.
- **Methodology string** in each profile states OSINT scope (official sites, indexed careers, public boards — no privileged channels).
- **Logo:** when a public `website` URL is present, a **derived** logo URL uses the registrable domain (`https://logo.clearbit.com/<host>`). That is a third-party convenience, not a claim of trademark ownership; failed loads are hidden in the UI.
- **Human review:** richer narratives, programme lists, and explicit **references[]** should be added via `osint_profiles.json` after primary-source verification.
- **Desk corpus merge (automated):** each `osintProfile` now also pulls **cross-dataset** open signals at build/API time:
  - **`job_possibility.json`** — narrative fields (staff / beneficiaries / hiring) and **URLs** embedded in those text fields become **`references[]`** entries when parseable.
  - **`athens_greece.json` → `jobOpenings.postings[]`** — each posting **`url`** is added to **`references[]`** (deduped) as a public careers / notice link.
  - **`athens_greece.json` → `website`**, **`jobOpenings.careersUrl`**, **`jobOpenings.sources`** (host-style hints such as `metadrasi.org` or `linkedin.com/...` normalised to `https://…`), and **URLs inside posting `notes`** → **`references[]`** where parseable.
  - **`job_possibility.json` → `why`** — embedded **http(s)** links → **`references[]`** when parseable.
  - **`job_openings_summary.json`** → **`researched[].careersUrl`** (per org) echoes the compact careers link into **`references[]`** for researched rows.
  - **`spontaneous_emails.json`** — per-org **`applyUrl`** (ATS) and URLs found in **notes** are merged into **`references[]`** when present.
  - **Employment UI:** **`employmentSignals.discoverySourceUrls`** lists clickable URLs parsed from **`jobOpenings.sources`** (same order as the string list; plain labels stay without a link).
  - **Quick links:** **`onlinePresence.contactHints`** lists every **`spontaneous_emails.json`** row for that **`orgId`** (label + mailto + optional ATS **applyUrl**), so multi-inbox orgs surface fully without hand-editing the page.
  - **`media_week.json`** — digest articles are matched to organisations by **name / Greek name / parenthetical acronyms / org-id slug tokens / website domain label / alias map**; matching uses **word-boundary checks** (not raw substring) and a **stopword list** for tokens that are too generic alone (e.g. hellas, greece, athens). Matched pieces appear as **`deskCorpus.mediaDigestMatches`**. **Additional `http(s)` links in the article `body`/`dek`** (when the piece already matched that org) are merged into **`references[]`** as “Digest — further link”, excluding duplicates of the primary `sourceUrl` and the org’s own website host.
  - **`identity.aliases`** — short strings for search / UI (acronyms + map); not a legal name registry.
  - **Deduping:** reference URLs are deduped after **normalising** scheme/host/path (query stripped) so the same page is not listed twice under different query strings.
  - **`scaleSignals` (merged):** when the registry `jobPossibility` row lacks staff/beneficiary labels but **`job_possibility.json`** has them, the merged profile fills **`staffEstimate`** / **`beneficiariesLabel`** from the possibility dataset; **`sourcesNote`** explains the merge when both corpora exist.
- **Not automatic:** live crawling of every NGO website, full social-graph mapping, or exhaustive registry reconciliation — those require steward time or `osint_profiles.json` enrichment.

## Civic events (Phase B lane)

- **Published events** may be steward-entered or **scraped** from ICS/RSS/HTML/API adapters configured per source ([NGO_EVENTS.md](./NGO_EVENTS.md)).
- **Scraped rows** default to **`pending_review`**; they are **not** shown on the public calendar until a steward publishes or merges them.
- **Deduping** uses `externalKey` + source URL; stewards resolve ambiguous duplicates manually.
- **NGO-to-NGO threads** on events are **not** public chat; participation requires steward-assigned org membership.
- **UI:** `#org/<organisation-id>` — e.g. `#org/ngo-001-metadrasi`.

## Versioning

- Dataset changes should bump a **`meta` fingerprint** or git tag; large shifts in methodology require a new dated section here and legal/comms review per [GOVERNANCE_RACI.md](./GOVERNANCE_RACI.md).
