# Greece NGO Desk

Minimalist commercial static site for **Greece-wide** NGO openings, spontaneous candidature emails, weekly NGO media, and registry tools.

## Open

From the **repository root**:

```powershell
npm run build:data
Start-Process (Resolve-Path "static-site\index.html").Path
```

## Mobile

- **Desktop-first** layout (≥1024px); phone uses scrollable top nav, **bottom dock** (Home · Jobs · NGOs · Media · Life · Apply · **More** → search), single-column cards, and horizontally scrollable guide steppers. Styles: `stitch-mobile.css` (safe areas, touch targets ≥44px). Preview: narrow DevTools or `npm run test:e2e:static` (includes `e2e/mobile-layout.spec.js`).

## Design

- **Home**: full-bleed Acropolis hero — brand, headline, line, two CTAs; **three hot-story cards** stacked on the right
- **Media**: Mon–Sun prior-week digest — separated article cards with image + copy + source link
- Stage: glass overlay on free civic photos (Unsplash / Pexels); cool white / ink / teal
- Each inner page has one visual strip; credits in `img/ATTRIBUTION.md`

## Pages

1. **Home** — landing + hot rail  
2. **Media** — weekly NGO digest (`../data/ngos/media_week.json`)  
3. **Life** — places, events, and day-to-day of NGO workers in Greece  
4. **Openings** — dated vacancies (all-Greece by default; optional Athens / Attica filter)  
5. **Apply** — spontaneous candidature emails (`mailto:`)  
6. **Registry** — 104 orgs; **search + region** first, **More filters** for exact scope / sector / score; quick presets; each name links to **OSINT profile** (`#org/<id>`)  
7. **Scores** — job-possibility ranking  
8. **Found / Fund** — create NGO + funding guides  

**Per-organisation OSINT page:** open any registry row or vacancy row, or go directly to `#org/ngo-001-metadrasi` (replace with the org id from the table).

**Openings filters:** search, **Where** (all / Athens area / other Greece), and **Thematic sector** (organisation’s sector) — sector filters the posting via its employer, not the job title alone.

## Refresh data

From repo root:

```powershell
npm run merge:jobs
npm run build:data
npm run osint:coverage   # optional: data/ngos/osint_coverage_report.json (gitignored)
```

**National batch import** (new organisations with full registry shape): `npm run import:registry -- data/ngos/imports/your_batch.json` then `npm run audit:registry-duplicates`, `npm run validate`, `npm run build:data`.

Sources under `data/ngos/`: `job_research_seed.json`, `spontaneous_emails.json`, `media_week.json`, etc. See `docs/DATA_PIPELINE.md`.
