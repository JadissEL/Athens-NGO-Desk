# Greece NGO Desk — Stitch prompts

**Project:** [Greece NGO Desk](https://stitch.withgoogle.com/) · id `14677559256789528548`  
**Design system:** Aegean Civic Craft · `assets/d42af7c3d09e40089c1623f92d77b011`  
**Device:** `DESKTOP` at **1440×900** unless noted.

How to use: **Stitch UI** → project → **Generate from text** → paste **one block** below. Or MCP `generate_screen_from_text` with `projectId`, `deviceType: DESKTOP`, `designSystem`, `prompt`.

Order: run **§A Specific** screens first (1→7), then **§B Wide** once to align variants / mobile.

---

## §A — Specific prompts (one screen each)

### A1 — Home / command center

```
Product: Greece NGO Desk — Greece-wide civic SaaS (not Athens-only branding; Athens is a filter).
Design system: Aegean Civic Craft — teal #0f7c7c, terracotta #d97736, warm white cards, Playfair Display headlines, Manrope/Plus Jakarta UI body.

Desktop 1440px. Layout:
- Left: fixed 92px dark teal vertical icon rail (Home, Jobs, NGOs, Media, Apply, Life, Fund) with subtle glow on active item.
- Top: frosted glass app bar — wordmark "Greece NGO Desk", grouped nav (Discover / Work / Guides), ghost "Search Ctrl+K", primary "Apply by email".
- Hero split: LEFT editorial — eyebrow "Greece-wide · Civic signposting", Playfair H1 "Find NGOs, roles & stories that matter.", short lead on jobseekers/funders/service seekers (signposting, not crisis line).
- Hero RIGHT: floating search dock card 32px radius — fields: Keywords, Looking for (NGOs / Openings / Media), Region (All Greece / Athens / National), black-teal gradient primary "Search desk".
- Row: 4 KPI bento tiles (Organisations, Indexed openings, With vacancy research, Media stories) with large numbers.
- Row: 3 audience bento cards mint/sand/sky gradients — Jobseekers, Funders & donors, Service seekers — each with dark CTA.
- Section "Hot this week" + 3 story cards (date chip, title, dek).
Background: soft mesh + light grid, premium Stripe/Linear density. NO mobile bottom tabs on desktop.
```

### A2 — Openings (job board + master–detail)

```
Greece NGO Desk — Openings page. Aegean Civic Craft. Desktop 1440px, same shell (teal rail + glass top nav).

3-column workbench:
- LEFT 280px filter rail (white frosted card): stats compact, "Soon" deadline chips (org + role + date), search "Find a role", Where (All / Athens / Outside), Thematic sector dropdown.
- CENTER: toolbar "N openings" + Cards|Table pill toggle. Scrollable list of JOB CARDS — each card: gradient cap with "Opening" badge, circular org initials, bold role title, org name link, location, pills (kind, posted, deadline urgency terracotta if <14d), actions Details + Apply primary.
- RIGHT 380px sticky APPLICATION PANEL: terracotta-to-teal 4px top stripe, role H2, org + sector link, fact dl (Posted, Deadline, Location, Type), dek, buttons Apply on site (primary), Spontaneous CV, Org profile.

Feel: modern NGO job board (LinkedIn Jobs / Greenhouse list density), not a government HTML table. Empty state friendly copy.
```

### A3 — Registry (NGO cards + org sheet)

```
Greece NGO Desk — NGO registry. Aegean Civic Craft. Desktop 1440px, same app shell.

LEFT 280px discover rail: search "Find an organisation", Region select, quick chips (All listed, Has vacancy research, High job score 65+, Athens area, Greece-wide), collapsible "More filters" (sector, scope, score).

CENTER: count line + Cards|Table toggle. Card grid — each NGO card: pastel gradient cap with SCORE PILL (e.g. "72") or "Unscored", initials avatar with ring shadow, org name, sector · region meta, pills for jobs count and possibility band, Profile + Detail CTAs.

RIGHT sticky ORG SHEET: org name, Greek name subtitle, fact grid (Focus, Jobs indexed, Possibility, Staff, Website, Careers, Spontaneous CV), Best-fit roles list, Recent postings list, why line. Close button.

104 organisations context in microcopy footer. Desktop-first, wide grid.
```

### A4 — Organisation profile (HR split)

```
Greece NGO Desk — single organisation profile (HR / company page style). Aegean Civic Craft. Desktop 1440px.

Breadcrumb: Registry › METAdrasi (example). Two columns:
- LEFT 300px sticky IDENTITY CARD: optional logo, display name Playfair, Greek name, sector/scope, primary buttons (website, careers, apply by email), link stack, OSINT methodology note small.
- RIGHT: pill tab bar Overview | Mission | Jobs | References | Desk — active tab ink-deep filled pill. Content cards: narrative, desk corpus, employment signals, grouped reference links by type, possibility note.

Split layout like LinkedIn company + Greenhouse benefits tabs. NO accordion-only mobile pattern on desktop.
```

### A5 — Media digest

```
Greece NGO Desk — weekly NGO media digest. Aegean Civic Craft. Desktop 1440px.

Page title Media, subtitle "NGO digest · week range · Greece civil society". Filter search field. Vertical feed of MAGAZINE CARDS: left 220px image crop, right body with date, Hot badge, source, Playfair-ish H2 title, dek, 2-3 paragraph excerpts, tag chips, primary "Read source ↗". Cards full width in one column, generous whitespace. Civic journalism tone, not blog spam.
```

### A6 — Apply (spontaneous CV grid)

```
Greece NGO Desk — Spontaneous candidature. Aegean Civic Craft. Desktop 1440px.

Header + tip line. Responsive card grid of NGOs with email/ATS — each card: gradient cap, initials, org name, Email/ATS pill, mailto or ATS link prominent, note, Send CV primary + Profile secondary. Same card component as registry/jobs for system unity.
```

### A7 — Scores (possibility ranking)

```
Greece NGO Desk — Job-finding possibility scores. Aegean Civic Craft. Desktop 1440px.

Warning callout (competitive market). Top KPI row showing top 4 scores. Below: ranked card grid — score pill with band color (High/Medium/Low), score bar 0-100, staff/people meta, why text, Profile + Openings actions. Bento analytics dashboard meets NGO transparency.
```

---

## §B — Wide prompts (platform + system)

### B1 — Platform charter (generate design system + home if new)

```
Design a complete desktop-first WEB PLATFORM (not a mobile app on desktop) for Greece NGO Desk — signposting Greek civil society for jobseekers, funders, donors, and people seeking NGO services. Greece-wide product name only.

Visual DNA: Aegean Civic Craft — Mediterranean premium civic tech. Colors: deep teal ink, aegean accent, terracotta sun accents, warm paper backgrounds, mint/sand/sky bento pastels. Typography: Playfair Display for hero H1 only; Manrope or Plus Jakarta for UI. Corner radius 24-32px on cards. Soft mesh background + subtle grid.

Components to define once and reuse everywhere:
- Dark teal 92px icon sidebar (desktop ≥1024px only)
- Frosted top bar with grouped navigation
- Search dock card pattern
- NGO/job/media card with gradient cap + initials avatar
- Master-detail split (list + sticky right panel)
- Pill toggles Cards/Table
- Primary gradient teal CTA, dark secondary

Deliver a HOME screen that establishes this system at 1440px with obvious "wow" vs static government sites. Linear/Stripe/Notion platform energy.
```

### B2 — All workbench pages (single mega-prompt)

```
Using Aegean Civic Craft for Greece NGO Desk, generate a cohesive DESKTOP suite at 1440px:

1) Registry workbench — filters + NGO card grid + org detail sheet
2) Openings workbench — filters + job cards + application panel
3) Apply — email card grid
4) Scores — ranked possibility cards

Same sidebar, same top bar, same card DNA, same master-detail behavior. Information-dense but breathable. Greece NGO copy placeholders (METAdrasi, ARSIS, legal aid, shelter). Show Cards/Table toggle on registry and jobs. This is one product family — no style drift between pages.
```

### B3 — Guides + trust pages

```
Greece NGO Desk — desktop pages: Audiences (who this is for), Legal notice, Life of an NGO worker, Found an NGO, Fund an NGO. Aegean Civic Craft. Wide readable column max 720px content but full platform chrome (sidebar + top nav). Life page: week rhythm as 4 guide-day cards. Guides use stepped cards not bare HTML. Trust/legal tone calm and professional. Same mesh background as rest of app.
```

### B4 — Mobile adaptation only (after desktop approved)

```
Take Greece NGO Desk Aegean Civic Craft DESKTOP designs and produce MOBILE 390px adaptations ONLY where structure changes: bottom dock navigation (4-5 icons), single column cards, job detail as bottom sheet/drawer not right pane. Hide sidebar. Keep teal brand. Do NOT shrink desktop layout — redesign mobile intentionally. Touch targets adequate but not oversized on tablet 768px bridge.
```

### B5 — Polish pass (edit existing Stitch screens)

```
On existing Greece NGO Desk Stitch screens: increase visual drama — stronger mesh backgrounds, glass blur on top bar, larger Playfair hero type, deeper card shadows, terracotta accent stripe on detail panels, hover lift on cards. Remove any dry government-table aesthetic. Keep accessibility contrast. Desktop 1440. Product name Greece NGO Desk everywhere.
```

---

## MCP example

```json
{
  "projectId": "14677559256789528548",
  "deviceType": "DESKTOP",
  "designSystem": "assets/d42af7c3d09e40089c1623f92d77b011",
  "prompt": "<paste A2 block>"
}
```

After generation: `list_screens` → `download_file` → align `static-site/` (see tracker).

**Auth:** if MCP fails, paste prompts in Stitch UI manually.
