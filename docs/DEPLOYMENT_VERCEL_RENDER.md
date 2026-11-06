# Deploy: Vercel (static site) + Render (API) + Clerk (steward)

Split deployment matches the repo layout: **public desk** is static assets; **Phase B API** is Node + Postgres.

## Architecture

| Layer | Folder | Host | Serves |
|-------|--------|------|--------|
| Public UI | `static-site/` | **Vercel** (recommended) | `index.html`, `data.js`, `app.js` |
| API | `server/` | **Render** (or Fly / Azure / Railway) | `GET /api/ngo-data`, steward, health |

**Clerk** is for **steward** sign-in (`/steward/` on the API host). Public `/api/ngo-data` stays unauthenticated.

## 1. Postgres (EU)

Use Neon, Render Postgres, or another EU region. Copy the connection string → **`DATABASE_URL`** on the API service.

From `server/` locally (after DB exists):

```bash
npx prisma migrate deploy
npm run db:seed
```

Then use the steward UI to **Publish** so `GET /api/ngo-data` returns 200 (not 404).

## 2. Render — API

1. Connect this GitHub repo to Render.
2. **New Web Service** — use **[`render.yaml`](../render.yaml)** (Blueprint) **or** manual:
   - **Root directory:** `server`
   - **Build:** `npm ci && npx prisma migrate deploy && npm run build && npx tsx scripts/seed_from_json.ts --if-empty` (Blueprint seeds once if there is no published bundle yet)
   - **Start:** `npm start`
   - **Health check path:** `/api/ready` (or `/api/health` — DB optional for `health`)
3. **Environment variables** (Blueprint can inject `DATABASE_URL` from linked Postgres via `fromDatabase` in `render.yaml`; Clerk keys and `CORS_ORIGIN` stay in the dashboard)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | yes | Linked Render Postgres (`fromDatabase` in blueprint) or paste URL if manual |
| `CLERK_SECRET_KEY` | yes* | Server verifies steward JWTs (*if using Clerk) |
| `CLERK_PUBLISHABLE_KEY` | yes* | `GET /api/steward-config` for steward UI |
| `CLERK_AUTHORIZED_PARTIES` | recommended | Origins allowed for session tokens — include **Vercel URL** and **Render API URL** if steward loads from API host |
| `CORS_ORIGIN` | yes for browser | Your Vercel origin, e.g. `https://your-desk.vercel.app` (not `*` in production) |
| `PORT` | auto | Render sets `PORT`; server reads it |
| `HOST` | optional | Default `0.0.0.0` |

Optional: `STEWARD_API_KEYS` break-glass if not using Clerk alone.

Note: **`GET /api/ngo-data`** merges OSINT at runtime using bundle JSON already in Postgres; `data/ngos/*.json` is **not** required on the server disk in production.

### Render manual service + `render.yaml`

If the API was created **manually** (not from a synced Blueprint), Render does **not** apply `render.yaml` env vars. Either:

1. **Dashboard (fastest):** Web service → **Environment** → **Add** → **Link database** → choose **`athens-ngo-desk-db`** (sets `DATABASE_URL`), then **Save** and **Manual deploy**; or  
2. **Blueprint:** [Create a Blueprint](https://dashboard.render.com) from this repo so `fromDatabase` in [`render.yaml`](../render.yaml) syncs to the service.

Until `DATABASE_URL` is present, **`prisma migrate deploy` fails** during build (P1012).

### New Render account (e.g. second workspace / email)

The Cursor **Render MCP** only sees the workspace linked to its integration. To provision **Postgres + Web service** on another Render login (for example **bognboa@gmail.com**):

1. Log into Render as that user → **Account Settings** → **API Keys** → create a key (do not paste it into chat or git).
2. On that same account, ensure **GitHub** is connected so Render can clone `https://github.com/JadissEL/Athens-NGO-Desk`.
3. From the repo root in PowerShell:

```powershell
$env:RENDER_API_KEY = "<your key>"
.\scripts\render_provision_api.ps1
```

The script creates a **Frankfurt** Postgres plus a **Node** web service (`rootDir: server`, build includes migrate + optional seed). It sets **`DATABASE_URL`** from the DB **internal** connection string (same region as the service).

4. When the deploy is **live**, set **`window.NGO_DATA_API_BASE`** in `static-site/index.html` to the new `https://*.onrender.com` URL and redeploy Vercel.

## 3. Vercel — static site

1. **New Project** → import the repo.
2. **Root Directory:** `static-site` (important: not repo root).
3. **Framework preset:** Other — **no build command** (or `echo skip`).
4. **Output:** `.` (static files from `static-site`).

### Live API instead of bundled `data.js`

Uncomment and set the API base **before** `data_loader.js` in [`static-site/index.html`](../static-site/index.html):

```html
<script>
  window.NGO_DATA_API_BASE = "https://your-service.onrender.com";
</script>
```

[`data_loader.js`](../static-site/data_loader.js) fetches `GET {base}/api/ngo-data`. If the fetch fails, [`app.js`](../static-site/app.js) falls back to `data.js`.

Ensure **Render `CORS_ORIGIN`** includes your exact Vercel URL (scheme + host, no trailing slash).

## 4. Clerk

1. Create application in [Clerk Dashboard](https://dashboard.clerk.com).
2. Copy **Secret** → `CLERK_SECRET_KEY` on Render.
3. Copy **Publishable** → `CLERK_PUBLISHABLE_KEY` on Render.
4. **Allowed origins / authorized parties:** add Vercel production URL, preview URLs if needed, and the Render API URL if you open steward at `https://api.../steward/`.

Open steward: **`https://<render-host>/steward/`** (static files served by Fastify from `server/public/steward/`).

## 5. Smoke test

```bash
curl -fsS "https://<render-host>/api/health"
curl -fsS "https://<render-host>/api/ready"
curl -fsS "https://<render-host>/api/ngo-data" | head -c 400
```

## Related

- [DEPLOYMENT_CLOUD_RUN.md](./DEPLOYMENT_CLOUD_RUN.md) — host the API on **Google Cloud Run** instead of Render
- [STAGING.md](./STAGING.md) — EU checklist, env names
- [server/README.md](../server/README.md) — routes and auth
- [SECURITY.md](./SECURITY.md) — keys and rotation
