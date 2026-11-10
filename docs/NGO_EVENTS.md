# NGO civic events & collaboration

**Not legal advice.** Greece NGO Desk lists **civil-society-related events** and lets **verified organisation members** coordinate via in-app threads. The desk does **not** sell tickets, guarantee attendance, or replace official emergency channels.

## Roles

| Role | Responsibilities |
|------|------------------|
| **Steward** | Create/publish events on behalf of NGOs (v1); approve scraped rows; assign org members; moderate threads |
| **Org member** | Steward-assigned Clerk user linked to a registry `ngo-*` id; may participate in event threads |
| **Public visitor** | Browse published events only |
| **Controller (deployer)** | Privacy notice for thread messages; scrape ToS compliance; EU residency for Postgres |

## Event sources

| Source | Behaviour |
|--------|-----------|
| `steward` | Steward console → `published` when approved |
| `scrape` | Worker ingests feeds/pages → `pending_review` until steward **publish**, **reject**, or **merge** |
| `org_portal` | Phase 2 — NGO self-publish after verification |

## Scraping ethics (v1)

- Prefer **ICS/RSS** and URLs the organisation already publishes.
- **Eventbrite:** official API when `EVENTBRITE_API_TOKEN` is set.
- **Facebook:** **Graph API only** when `FACEBOOK_GRAPH_TOKEN` is set — **no blind HTML scraping** in production.
- Respect `robots.txt` where checked; disable adapters that error repeatedly (`EventScrapeSource.lastError`).
- Scraped copy is **provisional** until steward review.

## Collaboration threads

- Threads are tied to a **published event**; participants are **registry organisations** (`EventThreadParticipant`).
- Only users with an **OrgMember** row (steward-assigned) for a participating org may read/post.
- Message retention: **24 months** default; erasure via desk contact in production README.
- Stewards may **close** threads; abusive content → suspend org member assignment.

## Related

- [METHODOLOGY.md](./METHODOLOGY.md) — OSINT and automated signals
- [LEGAL_NOTICE.md](./LEGAL_NOTICE.md) — disclaimers
- API: `GET /api/events`, steward `POST /api/steward/events`, `POST /api/events/:id/threads`
