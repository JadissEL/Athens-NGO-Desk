# Stitch implementation checklist

Track parity between [STITCH_SCREEN_PROMPTS.md](STITCH_SCREEN_PROMPTS.md) and `static-site/`.

| Screen | Prompt | Static route | Status |
|--------|--------|--------------|--------|
| Home | A1 | `#page-overview` | Trust strip, mesh, dock, bento tiles — **CSS done**; awaiting Stitch HTML |
| Openings | A2 | `#page-jobs` | 280px rail + **list-row job cards** + application panel — **aegean-stitch2** |
| Registry | A3 | `#page-registry` | List-row cards + org brief panel — **aegean-stitch3** |
| Org profile | A4 | `#page-org-profile` | Identity + tabs polish — **stitch3 partial** |
| Media | A5 | `#page-media` | Feed cards — **partial** |
| Apply | A6 | `#page-apply` | Card grid — **done** |
| Scores | A7 | `#page-possibility` | Ranked cards — **done** |

**CSS layers:** `bento-upgrade.css` → `stitch-polish.css` → `stitch-layout.css`.

When Stitch HTML downloads exist, drop under `static-site/stitch-import/` and diff against checklist rows.
