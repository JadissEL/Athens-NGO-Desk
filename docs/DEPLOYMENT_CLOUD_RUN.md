# Deploy API on Google Cloud Run

The static site can stay on **Vercel**; run the **Fastify + Prisma API** as a container on **[Cloud Run](https://cloud.google.com/run)** (scale to zero, pay per use; fits the free tier allowances).

## What ships in the image

The repo root [`Dockerfile`](../Dockerfile) copies **`server/`** plus **`scripts/`**, **`schemas/`**, **`data/ngos/`**, and **`docs/`** so runtime paths in `server/src/index.ts` (`repoRoot`) keep working.

Startup runs **`prisma migrate deploy`** then **`node dist/index.js`**. **Seed** is not automatic on Cloud Run (run once after first deploy — see below).

## Prerequisites

- Google Cloud project with **Artifact Registry** and **Cloud Run API** enabled.
- **PostgreSQL** reachable from Cloud Run (e.g. [Neon](https://neon.tech), Supabase, or any host that allows SSL). Use a URL with `?sslmode=require` if the provider requires TLS.
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) `gcloud` installed and authenticated.

## Environment variables

Set these on the Cloud Run service (Console → service → **Edit & deploy** → **Variables**):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | yes | Pooled or direct Postgres URL |
| `CORS_ORIGIN` | yes for browser | e.g. `https://greece-ngo-desk.vercel.app` |
| `CLERK_SECRET_KEY` | if using Clerk | Steward JWT verification |
| `CLERK_PUBLISHABLE_KEY` | if using Clerk | Exposed via `GET /api/steward-config` |
| `CLERK_AUTHORIZED_PARTIES` | recommended | Vercel + Cloud Run service URL |

Cloud Run sets **`PORT`**; the app reads it (defaults to `4000` locally, **`8080` in the Docker image**).

## Build and deploy (example)

Replace `PROJECT`, `REGION`, and `REPO` with your values.

```bash
gcloud config set project PROJECT_ID

# Artifact Registry (one-time per region)
gcloud services enable artifactregistry.googleapis.com run.googleapis.com

gcloud artifacts repositories create greece-ngo-desk \
  --repository-format=docker \
  --location=REGION

export IMAGE="REGION-docker.pkg.dev/PROJECT_ID/greece-ngo-desk/api:$(git rev-parse --short HEAD)"

# From repo root (where Dockerfile lives)
docker build -t "$IMAGE" .
docker push "$IMAGE"

gcloud run deploy greece-ngo-desk-api \
  --image "$IMAGE" \
  --region REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://...,CORS_ORIGIN=https://greece-ngo-desk.vercel.app"
```

Use **Secrets** for `DATABASE_URL` / Clerk keys in production (`--set-secrets`).

## First-time database seed (one-off)

After the service URL works for `/api/health`, run seed **once** using a temporary Cloud Run **Job** or local machine with `DATABASE_URL`:

```bash
cd server
npm ci
npx prisma migrate deploy
npx tsx scripts/seed_from_json.ts
```

Or from any machine that can reach the DB: same commands with the production `DATABASE_URL`.

## Point the static site at Cloud Run

In [`static-site/index.html`](../static-site/index.html), set:

```js
window.NGO_DATA_API_BASE = "https://YOUR-SERVICE-REGION-PROJECT.run.app";
```

Redeploy Vercel `static-site/`.

## Related

- [DEPLOYMENT_VERCEL_RENDER.md](./DEPLOYMENT_VERCEL_RENDER.md) — Vercel + Render variant
- [NEON_PRISMA.md](./NEON_PRISMA.md) — Prisma + Postgres notes
