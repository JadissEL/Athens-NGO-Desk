# Hospitality & tourism employment lane

**Not legal advice.** Greece NGO Desk adds a **Hospitality & tourism** track alongside indexed NGO openings. Employers post roles; job seekers (including immigrants and people in difficult situations) may **apply in the portal**. This lane is **not** a licensed employment agency and does **not** guarantee placement.

## Roles

| Role | Responsibilities |
|------|------------------|
| **Verified employer** | Accurate job posts; fair hiring practices; respond to applicants; honour GDPR when reviewing applications |
| **Job seeker** | Truthful CV and contact data; consent before submit |
| **Desk steward** | Employer verification, moderation, suspend abusive accounts |
| **Controller (deployer)** | Privacy notice, retention, subprocessors, EU residency for Postgres and CV storage |

## Employer verification (v1)

1. Employer signs in with **Clerk** and completes company profile (`POST /api/hospitality/employer/register`).
2. Status starts **`pending`** until a steward sets **`verified`** (manual check: trade name, ΑΦΜ where provided, website).
3. Only **verified** employers may **publish** jobs.
4. **`suspended`** employers cannot post or access application inboxes.

Prohibited posts: fees charged to workers, undisclosed intermediaries, discriminatory language, roles unrelated to hospitality/tourism in Greece.

## Job seeker data (GDPR)

- **Purpose:** relay application to the employer for recruitment for a specific vacancy.
- **Legal basis (orientation):** consent at submit (`gdprConsentAt`) and legitimate interest of employer to assess candidacies.
- **Recipients:** the posting employer and desk operators (support / abuse review).
- **Retention:** applications retained **24 months** from submit unless erasure requested earlier; CV blobs deleted with the application record.
- **Rights:** erasure and access requests to **desk@example.org** (replace in production README).
- **Minimisation:** no account required in v1; email and phone are required to contact the seeker.

## Positioning vs recruitment agency

The desk **lists vacancies and forwards applications**; it does **not** negotiate contracts, collect placement fees from workers, or provide work-permit legal advice. Official migration and labour resources remain authoritative.

## Related

- [AUDIENCES.md](./AUDIENCES.md) — jobseekers and hospitality subsection
- [LEGAL_NOTICE.md](./LEGAL_NOTICE.md) — general disclaimers
- API: `GET /api/hospitality/jobs`, `POST /api/hospitality/applications`
