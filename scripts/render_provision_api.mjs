#!/usr/bin/env node
/**
 * Idempotent: creates or updates Postgres + Web Service on Render via https://api.render.com/v1
 * Set RENDER_API_KEY in env (GitHub secret or local). Do not commit keys.
 *
 * Env:
 *   RENDER_API_KEY     (required)
 *   OWNER_EMAIL        default: elantaki.dijadiss@gmail.com
 *   DB_NAME            default: greece-ngo-desk-db (legacy alias: athens-ngo-desk-db)
 *   SERVICE_NAME       default: greece-ngo-desk-api (legacy alias: athens-ngo-desk-api)
 *   REPO_URL           default: https://github.com/JadissEL/Athens-NGO-Desk
 *   REPO_BRANCH        default: main
 *   CORS_ORIGIN        default: https://greece-ngo-desk.vercel.app
 *   REGION             default: frankfurt
 *   PG_PLAN            default: basic_256mb
 *   SERVICE_PLAN       default: starter
 *   PG_VERSION         default: 16
 */
import process from "node:process";

const BASE = "https://api.render.com/v1";

const RENDER_API_KEY = process.env.RENDER_API_KEY;
if (!RENDER_API_KEY) {
  console.error("Missing RENDER_API_KEY");
  process.exit(1);
}

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "elantaki.dijadiss@gmail.com";
const DB_NAME = process.env.DB_NAME ?? "greece-ngo-desk-db";
const SERVICE_NAME = process.env.SERVICE_NAME ?? "greece-ngo-desk-api";
/** @deprecated Renamed to Greece NGO Desk — provision script renames these when found. */
const LEGACY_DB_NAME = "athens-ngo-desk-db";
const LEGACY_SERVICE_NAME = "athens-ngo-desk-api";
const REPO_URL = process.env.REPO_URL ?? "https://github.com/JadissEL/Athens-NGO-Desk";
const REPO_BRANCH = process.env.REPO_BRANCH ?? "main";
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ??
  "https://jadissel.github.io,https://greece-ngo-desk.vercel.app";
const REGION = process.env.REGION ?? "frankfurt";
const PG_PLAN = process.env.PG_PLAN ?? "basic_256mb";
const SERVICE_PLAN = process.env.SERVICE_PLAN ?? "starter";
const PG_VERSION = Number(process.env.PG_VERSION ?? 16);

const BUILD_CMD =
  "npm ci && npx prisma migrate deploy && npm run build && npx tsx scripts/seed_from_json.ts --if-empty && npm run db:seed:hospitality && npm run db:seed:events";
const START_CMD = "npm start";

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

async function api(method, path, body) {
  const opts = { method, headers: headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  if (!res.ok) {
    const msg = typeof json?.message === "string" ? json.message : text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg.slice(0, 600)}`);
  }
  return json;
}

async function listAll(pathBuilder) {
  /** pathBuilder(cursor) -> path with cursor query */
  const out = [];
  let cursor = "";
  for (;;) {
    const path = pathBuilder(cursor);
    const chunk = await api("GET", path);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const row of chunk) out.push(row);
    const last = chunk[chunk.length - 1];
    if (!last?.cursor) break;
    cursor = last.cursor;
  }
  return out;
}

async function resolveOwnerId() {
  const rows = await listAll((c) =>
    c ? `/owners?limit=100&cursor=${encodeURIComponent(c)}` : `/owners?limit=100`
  );
  for (const row of rows) {
    const o = row.owner;
    if (o?.email === OWNER_EMAIL) return o.id;
  }
  throw new Error(`No Render workspace (owner) with email ${OWNER_EMAIL}. Use Account → Workspace on Render.`);
}

async function findPostgres(ownerId) {
  const wanted = new Set([DB_NAME, LEGACY_DB_NAME]);
  const rows = await listAll((c) => {
    const q = new URLSearchParams({ limit: "100", ownerId });
    if (c) q.set("cursor", c);
    return `/postgres?${q}`;
  });
  for (const row of rows) {
    const p = row.postgres;
    if (p?.name && wanted.has(p.name)) return { id: p.id, name: p.name };
  }
  return null;
}

async function renamePostgresIfLegacy(postgres) {
  if (postgres.name === DB_NAME) return postgres.id;
  if (postgres.name !== LEGACY_DB_NAME) return postgres.id;
  try {
    await api("PATCH", `/postgres/${postgres.id}`, { name: DB_NAME });
    console.log(`Renamed Postgres ${LEGACY_DB_NAME} → ${DB_NAME}`);
  } catch (e) {
    console.warn(`Could not rename Postgres (continuing with legacy name):`, e.message);
  }
  return postgres.id;
}

async function createPostgres(ownerId) {
  const body = {
    name: DB_NAME,
    ownerId,
    plan: PG_PLAN,
    region: REGION,
    version: PG_VERSION,
  };
  const created = await api("POST", "/postgres", body);
  return created.postgres.id;
}

async function waitConnectionInfo(postgresId) {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await api("GET", `/postgres/${postgresId}/connection-info`);
      if (info?.internalConnectionString) return info.internalConnectionString;
    } catch {
      /* provisioning */
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error("Postgres connection-info not ready (internal URL missing)");
}

async function findWebService(ownerId) {
  const wanted = new Set([SERVICE_NAME, LEGACY_SERVICE_NAME]);
  const rows = await listAll((c) => {
    const q = new URLSearchParams({ limit: "100", ownerId });
    if (c) q.set("cursor", c);
    return `/services?${q}`;
  });
  for (const row of rows) {
    const s = row.service;
    if (s?.name && wanted.has(s.name) && s.type === "web_service") return s;
  }
  return null;
}

async function renameWebServiceIfLegacy(service) {
  if (service.name === SERVICE_NAME) return service;
  if (service.name !== LEGACY_SERVICE_NAME) return service;
  try {
    const updated = await api("PATCH", `/services/${service.id}`, { name: SERVICE_NAME });
    const svc = updated?.service ?? updated;
    console.log(`Renamed web service ${LEGACY_SERVICE_NAME} → ${SERVICE_NAME}`);
    return svc;
  } catch (e) {
    console.warn(`Could not rename web service (URL may stay ${LEGACY_SERVICE_NAME}.onrender.com):`, e.message);
    return service;
  }
}

async function listServiceEnvVars(serviceId) {
  const rows = await listAll((c) => {
    const q = new URLSearchParams({ limit: "100" });
    if (c) q.set("cursor", c);
    return `/services/${serviceId}/env-vars?${q}`;
  });
  return rows.map((r) => r.envVar).filter(Boolean);
}

async function putServiceEnvVars(serviceId, envList) {
  await api("PUT", `/services/${serviceId}/env-vars`, envList);
}

function mergeEnv(existing, patch) {
  const map = new Map();
  for (const e of existing) {
    if (e?.key) map.set(e.key, e.value ?? "");
  }
  for (const e of patch) {
    map.set(e.key, e.value);
  }
  return [...map.entries()].map(([key, value]) => ({ key, value }));
}

async function createWebService(ownerId, databaseUrl) {
  const envVars = [
    { key: "DATABASE_URL", value: databaseUrl },
    { key: "NODE_VERSION", value: "20" },
    { key: "HOST", value: "0.0.0.0" },
    { key: "CORS_ORIGIN", value: CORS_ORIGIN },
  ];
  const body = {
    type: "web_service",
    name: SERVICE_NAME,
    ownerId,
    repo: REPO_URL,
    branch: REPO_BRANCH,
    rootDir: "server",
    autoDeployTrigger: "commit",
    envVars,
    serviceDetails: {
      runtime: "node",
      region: REGION,
      plan: SERVICE_PLAN,
      healthCheckPath: "/api/health",
      envSpecificDetails: {
        buildCommand: BUILD_CMD,
        startCommand: START_CMD,
      },
    },
  };
  return api("POST", "/services", body);
}

async function triggerDeploy(serviceId) {
  return api("POST", `/services/${serviceId}/deploys`, {
    clearCache: "clear",
    deployMode: "build_and_deploy",
  });
}

/** Align existing dashboard-created services with blueprint: rootDir server, seed on first build. */
async function patchWebServiceToServerRoot(serviceId) {
  const body = {
    rootDir: "server",
    serviceDetails: {
      healthCheckPath: "/api/health",
      envSpecificDetails: {
        buildCommand: BUILD_CMD,
        startCommand: START_CMD,
      },
    },
  };
  return api("PATCH", `/services/${serviceId}`, body);
}

async function main() {
  console.log(`Owner email: ${OWNER_EMAIL}`);
  const ownerId = await resolveOwnerId();
  console.log(`ownerId=${ownerId}`);

  let pg = await findPostgres(ownerId);
  let pgId;
  if (!pg) {
    console.log(`Creating Postgres ${DB_NAME}...`);
    pgId = await createPostgres(ownerId);
  } else {
    pgId = await renamePostgresIfLegacy(pg);
    console.log(`Using existing Postgres id=${pgId}`);
  }

  const internalUrl = await waitConnectionInfo(pgId);
  console.log("Got internal DATABASE_URL (not printed).");

  let service = await findWebService(ownerId);
  let serviceId;

  if (!service) {
    console.log(`Creating web service ${SERVICE_NAME}...`);
    const created = await createWebService(ownerId, internalUrl);
    service = created.service;
    serviceId = service.id;
    console.log(`serviceId=${serviceId} deployId=${created.deployId ?? "n/a"}`);
  } else {
    service = await renameWebServiceIfLegacy(service);
    serviceId = service.id;
    console.log(`Updating env + build config on existing service id=${serviceId}`);
    try {
      await patchWebServiceToServerRoot(serviceId);
      console.log("Patched rootDir=server and buildCommand (migrate + seed --if-empty).");
    } catch (e) {
      console.warn("PATCH service failed (build may stay dashboard-default):", e.message);
    }
    const existing = await listServiceEnvVars(serviceId);
    const merged = mergeEnv(existing, [
      { key: "DATABASE_URL", value: internalUrl },
      { key: "NODE_VERSION", value: "20" },
      { key: "HOST", value: "0.0.0.0" },
      { key: "CORS_ORIGIN", value: CORS_ORIGIN },
    ]);
    await putServiceEnvVars(serviceId, merged);
    console.log("Triggered redeploy after env update...");
    try {
      await triggerDeploy(serviceId);
    } catch (e) {
      console.warn("Deploy trigger failed (may auto-deploy from env change):", e.message);
    }
  }

  const fresh = await api("GET", `/services/${serviceId}`);
  const svc = fresh?.service ?? fresh;
  const url = svc?.serviceDetails?.url;
  if (url) {
    console.log(`serviceUrl=${url}`);
    console.log(`Health: ${url}/api/health`);
  } else {
    console.log("Fetch service URL from Render dashboard when deploy finishes.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
