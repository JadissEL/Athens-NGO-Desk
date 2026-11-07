# Stitch implementation checklist

Track parity between [STITCH_SCREEN_PROMPTS.md](STITCH_SCREEN_PROMPTS.md) and `static-site/`.

| Screen | Prompt | Static route | Status |
|--------|--------|--------------|--------|
| Home | A1 | `#page-overview` | Trust strip (live count), mesh, dock — **aegean-stitch5**; awaiting Stitch HTML |
| Openings | A2 | `#page-jobs` | List-row + application panel — **stitch5** |
| Registry | A3 | `#page-registry` | List-row + org brief — **stitch5** |
| Org profile | A4 | `#page-org-profile` | Tab card panels — **stitch5** |
| Media | A5 | `#page-media` | Magazine column — **stitch5** |
| Apply | A6 | `#page-apply` | Card grid + eyebrow — **stitch5** |
| Scores | A7 | `#page-possibility` | Ranked cards + score bar — **stitch5** |

| Wide | Prompt | Status |
|------|--------|--------|
| B5 Polish | B5 | **`stitch-b5.css`** + `body.stitch-b5` — **aegean-stitch5** |
| B3 Guides | B3 | Life/Create/Fund step cards (partial) |

**CSS load order:** `bento-upgrade.css` → `stitch-polish.css` → `stitch-layout.css` → `stitch-b5.css`.

When Stitch HTML downloads exist, drop under `static-site/stitch-import/` and diff against this table.
