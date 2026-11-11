import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { prisma } from "./lib/prisma.js";
import { assertBundleShape, type NgoDataBundle } from "./lib/bundle.js";
import { authorizeSteward, getActorSubject, getClerkVerifyOptions } from "./lib/auth.js";
import { registerHospitalityRoutes } from "./routes/hospitality.js";
import { registerCivicEventRoutes } from "./routes/civicEvents.js";
import { registerPlatformRoutes } from "./routes/platform.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.join(__dirname, "..");
const repoRoot = path.join(serverRoot, "..");

const requireCjs = createRequire(import.meta.url);
const { validateNgoDataBundle } = requireCjs(
  path.join(repoRoot, "scripts", "validate_data_schemas.js")
) as {
  validateNgoDataBundle: (data: Record<string, unknown>) => {
    ok: boolean;
    message?: string;
  };
};
const { mergeOsintIntoRegistry } = requireCjs(
  path.join(repoRoot, "scripts", "merge_osint_into_registry.js")
) as {
  mergeOsintIntoRegistry: (
    registry: Record<string, unknown>,
    root: string,
    opts?: {
      buildTimeIso?: string;
      possibility?: unknown;
      media?: unknown;
      emails?: unknown;
      summary?: unknown;
    }
  ) => Record<string, unknown>;
};

function withMergedOsintRegistry(bundle: NgoDataBundle): NgoDataBundle {
  const reg = bundle.registry as Record<string, unknown> | null | undefined;
  if (!reg || typeof reg !== "object") {
    return bundle;
  }
  const merged = mergeOsintIntoRegistry(reg, repoRoot, {
    buildTimeIso: new Date().toISOString(),
    possibility: bundle.possibility as unknown,
    media: bundle.media as unknown,
    emails: bundle.emails as unknown,
    summary: bundle.summary as unknown,
  });
  return { ...bundle, registry: merged };
}

async function getActorKey(req: Parameters<typeof authorizeSteward>[0]): Promise<string> {
  const auth = await authorizeSteward(req);
  return getActorSubject(auth);
}

function validateFullBundle(b: NgoDataBundle): void {
  const data = b as unknown as Record<string, unknown>;
  const res = validateNgoDataBundle(data);
  if (!res.ok) {
    throw new Error(res.message ?? "JSON Schema validation failed");
  }
}

async function ensureDraft(): Promise<NgoDataBundle> {
  const row = await prisma.draftBundle.findUnique({ where: { id: 1 } });
  if (!row) {
    throw new Error("Draft empty — run: cd server && npm run db:seed");
  }
  const bundle = {
    registry: row.registry,
    possibility: row.possibility,
    summary: row.summary,
    emails: row.emails,
    media: row.media,
  };
  assertBundleShape(bundle);
  return bundle;
}

export async function buildServer() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  const corsRaw = process.env.CORS_ORIGIN?.trim();
  const corsOrigin =
    corsRaw && corsRaw.includes(",")
      ? corsRaw.split(",").map((o) => o.trim()).filter(Boolean)
      : corsRaw || true;
  await app.register(cors, { origin: corsOrigin, credentials: true });

  const publicMax = Math.max(50, Number(process.env.RATE_LIMIT_PUBLIC_MAX ?? 300));
  const publicWindow = process.env.RATE_LIMIT_PUBLIC_WINDOW_MS ?? "1 minute";
  await app.register(rateLimit, {
    global: false,
    max: publicMax,
    timeWindow: publicWindow,
    skipOnError: true,
  });
  const publicApi = { config: { rateLimit: { max: publicMax, timeWindow: publicWindow } } };
  const applyMax = Math.max(10, Number(process.env.RATE_LIMIT_APPLY_MAX ?? 30));
  const applyWindow = process.env.RATE_LIMIT_APPLY_WINDOW_MS ?? "1 minute";
  const applyApi = { config: { rateLimit: { max: applyMax, timeWindow: applyWindow } } };
  const messageMax = Math.max(10, Number(process.env.RATE_LIMIT_MESSAGE_MAX ?? 60));
  const messageWindow = process.env.RATE_LIMIT_MESSAGE_WINDOW_MS ?? "1 minute";
  const messageApi = { config: { rateLimit: { max: messageMax, timeWindow: messageWindow } } };

  await app.register(fastifyStatic, {
    root: path.join(serverRoot, "public"),
    prefix: "/",
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: path.join(repoRoot, "docs"),
    prefix: "/desk-docs/",
    decorateReply: false,
  });

  app.get("/api/health", async () => ({ ok: true }));

  /** Public: publishable key + whether server has Clerk verify env (for steward UI). */
  app.get("/api/steward-config", async () => {
    const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? "";
    return {
      clerkPublishableKey,
      clerkServerConfigured: !!getClerkVerifyOptions(),
    };
  });

  app.get(
    "/api/ready",
    async (_req, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(503).send({ ok: false, db: false, error: msg });
      }
      return { ok: true, db: true };
    }
  );

  await registerHospitalityRoutes(app, { publicApi, applyApi });
  await registerCivicEventRoutes(app, { publicApi, messageApi });
  await registerPlatformRoutes(app);

  app.get("/api/ngo-data", { ...publicApi }, async (_req, reply) => {
    const row = await prisma.publishedBundle.findUnique({ where: { id: 1 } });
    if (!row) {
      return reply.status(404).send({ error: "No published bundle — seed and publish" });
    }
    const bundle = {
      registry: row.registry,
      possibility: row.possibility,
      summary: row.summary,
      emails: row.emails,
      media: row.media,
    };
    assertBundleShape(bundle);
    return withMergedOsintRegistry(bundle as NgoDataBundle);
  });

  app.get("/api/draft", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    try {
      const bundle = await ensureDraft();
      return bundle;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({ error: msg });
    }
  });

  app.get("/api/audit", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const take = Math.min(
      200,
      Math.max(1, Number((req.query as { limit?: string }).limit) || 50)
    );
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
    });
    return { items: rows };
  });

  app.patch("/api/draft/registry/organizations/:id", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const orgId = (req.params as { id: string }).id;
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "JSON body required" });
    }
    const draft = await ensureDraft();
    const reg = draft.registry as { organizations?: unknown[] };
    const orgs = Array.isArray(reg.organizations) ? reg.organizations : [];
    const idx = orgs.findIndex(
      (o) => typeof o === "object" && o && (o as { id?: string }).id === orgId
    );
    if (idx === -1) {
      return reply.status(404).send({ error: `Organization not found: ${orgId}` });
    }
    const nextOrgs = [...orgs];
    nextOrgs[idx] = body;
    const nextRegistry = { ...reg, organizations: nextOrgs };
    const nextDraft: NgoDataBundle = { ...draft, registry: nextRegistry };
    try {
      validateFullBundle(nextDraft);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(400).send({ error: "Publish gate: schema validation failed", detail: msg });
    }
    await prisma.draftBundle.update({
      where: { id: 1 },
      data: {
        registry: nextRegistry as object,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorKey: await getActorKey(req),
        action: "draft.patch.organization",
        entityType: "Organization",
        entityId: orgId,
        detail: {},
      },
    });
    return { ok: true, id: orgId };
  });

  app.post("/api/publish", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const draft = await ensureDraft();
    try {
      validateFullBundle(draft);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(400).send({ error: "Publish gate: schema validation failed", detail: msg });
    }
    const publishedPayload = withMergedOsintRegistry(draft);
    try {
      validateFullBundle(publishedPayload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({ error: "Published bundle OSINT merge failed schema validation", detail: msg });
    }
    const now = new Date();
    await prisma.publishedBundle.upsert({
      where: { id: 1 },
      update: {
        registry: publishedPayload.registry as object,
        possibility: publishedPayload.possibility as object,
        summary: publishedPayload.summary as object,
        emails: publishedPayload.emails as object,
        media: publishedPayload.media as object,
        publishedAt: now,
      },
      create: {
        id: 1,
        registry: publishedPayload.registry as object,
        possibility: publishedPayload.possibility as object,
        summary: publishedPayload.summary as object,
        emails: publishedPayload.emails as object,
        media: publishedPayload.media as object,
        publishedAt: now,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorKey: await getActorKey(req),
        action: "publish",
        entityType: "PublishedBundle",
        entityId: "1",
        detail: { publishedAt: now.toISOString() },
      },
    });
    return { ok: true, publishedAt: now.toISOString() };
  });

  return app;
}

async function main() {
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  const app = await buildServer();
  await app.listen({ port, host });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
