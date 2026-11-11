# Platform login (no RBAC)

One **Clerk** sign-in on the static site. Users pick a **dashboard type** — a stored preference that routes the UI, **not** a permission matrix.

## Dashboard types

| Type | Opens |
|------|--------|
| `jobseeker` | `#jobs` |
| `employer` | `#employer` |
| `ngo_member` | `#events` |
| `funder` | `#funding` |
| `donor` | `#audiences` |
| `steward` | API host `/steward/` (new tab) |

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/platform/config` | Public — list of dashboard types |
| GET | `/api/platform/me` | Clerk session — preference + hints (employer registered?, org count) |
| PUT | `/api/platform/me/dashboard` | Clerk session — `{ "dashboardType": "employer" }` |

Existing routes still enforce **domain** rules (verified employer, steward-assigned `OrgMember`). That is separate from dashboard preference.

## UI

- Header **Sign in** → `#account` when signed in
- Shared module: `static-site/platform-auth.js` (`window.PlatformAuth`)
- Clerk keys: same as steward (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` on Render); add static origins to `CORS_ORIGIN` and `CLERK_AUTHORIZED_PARTIES`.

## Database

`PlatformUserPreference` — one row per `clerkUserId`, migration `20251110230000_platform_login`.
