# Governance — RACI (cross-team metaphor)

Roles are **tracks** (Google-style R&D, GitHub-style platform, Microsoft-style enterprise) plus **domain reviewers**. Replace **Name — Role** placeholders when you staff the desk.

| Track | Primary owner (placeholder) |
|--------|----------------------------|
| Google-style R&D / product | **Product lead — Greece NGO Desk** |
| GitHub-style platform | **Repo/CI owner — Greece NGO Desk** |
| Microsoft-style enterprise | **Security/infra owner — Greece NGO Desk** |
| Legal reviewer | **Legal counsel — civil society data** |
| Stats reviewer | **Methodology owner — desk scores** |

| Activity | Google-style (R&D / product) | GitHub-style (platform) | Microsoft-style (enterprise) | Legal reviewer | Stats reviewer |
|----------|------------------------------|-------------------------|------------------------------|----------------|----------------|
| Product roadmap & ICP | **A** | C | C | I | I |
| Data methodology & score changes | **R** | I | I | C | **A** |
| JSON schema & CI | C | **A** | I | I | C |
| API + DB + migrations (`server/`) | C | **R** | **A** | C | I |
| Identity / IdP / keys | I | C | **A** | C | I |
| Release to production | C | **R** | **A** | **A** | C |
| Public copy (disclaimers) | **R** | I | C | **A** | I |
| Security incidents | C | **R** | **A** | C | I |
| Takedown / data subject handling | C | I | **R** | **A** | I |

**Legend:** **R** = Responsible · **A** = Accountable · **C** = Consulted · **I** = Informed

## Release gate (minimum)

1. `npm run validate` (root) — JSON Schema OK  
2. `server/`: migration reviewed; `STEWARD_API_KEYS` rotated if exposed  
3. Legal/stats sign-off on any change to **scores**, **methodology**, or **contact directory** semantics  
