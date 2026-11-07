# Stitch screen prompts (Aegean Civic Craft)

Use when [Stitch MCP](STITCH_MCP.md) is unavailable or timing out: open [stitch.withgoogle.com](https://stitch.withgoogle.com/) → project **Greece NGO Desk** (`14677559256789528548`) → design system **Aegean Civic Craft** (`assets/d42af7c3d09e40089c1623f92d77b011`).

After each screen generates, **Download HTML** and note the screen id for `edit_screens` / hand-implementation in `static-site/`.

## 1. Home (desktop 1440)

Premium Greece NGO Desk home: mesh gradient background, slim dark teal icon rail left, editorial Playfair headline left, floating white search dock right (24px radius, intent + region + CTA). Below: 4 KPI tiles, 3 large audience bento cards (mint/sand/sky), row of 3 editorial story cards. Aegean teal + terracotta accents. Desktop SaaS density, not mobile stretched.

## 2. Openings master–detail (desktop)

Job board split: left scrollable list of role cards (org initials avatar, title, location, deadline pill, Apply + Details); right sticky application panel with terracotta accent stripe, facts table, primary Apply CTA. Filter rail left 280px. Cards/Table toggle. Reference: modern NGO job board, not government table.

## 3. Registry bento grid + org sheet (desktop)

NGO registry: search rail, card grid with score pill on card header, sector + region meta; right sticky org brief (website, careers, spontaneous email, best-fit roles, recent postings). Warm white cards, soft shadows.

## 4. Org profile HR split (desktop)

Organisation profile: left sticky identity card (logo, name, links, actions); right tabbed content Overview / Mission / Jobs / References. Playfair title, Manrope body, grouped references.

## 5. Media digest (desktop)

Magazine grid: large image left on each story card, tags, Read source CTA. Filter field top. Aegean civic craft styling.

## Implementation map

| Stitch screen | Static site |
|---------------|-------------|
| Home | `#page-overview`, `bento-*.css`, `stitch-polish.css` |
| Openings | `#page-jobs`, `jobs-split`, `job-detail-pane` |
| Registry | `#page-registry`, `registry-split` |
| Org profile | `#page-org-profile`, `.org-desk` |
| Media | `#page-media`, `.media-feed-card` |

Interim visual pass without MCP: `static-site/stitch-polish.css` (loaded after `bento-upgrade.css`).
