import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authorizeSteward, getActorSubject } from "../lib/auth.js";
import { authorizeClerkSession } from "../lib/clerkSession.js";
import {
  eventReviewSchema,
  orgMemberSchema,
  scrapeSourceSchema,
  stewardEventSchema,
  threadCreateSchema,
  threadMessageSchema,
} from "../lib/civicEventsSchemas.js";
import { resolveHostNames, getRegistryOrgNameMap } from "../lib/registryNames.js";
import {
  isThreadParticipant,
  requireOrgMember,
} from "../lib/orgMemberAccess.js";
import { runAllScrapeSources, runScrapeForSource } from "../scrape/runScrape.js";

type PublicRateConfig = { config: { rateLimit: { max: number; timeWindow: string } } };

async function serializePublicEvent(
  ev: {
    id: string;
    title: string;
    description: string;
    startsAt: Date;
    endsAt: Date | null;
    timezone: string;
    location: string | null;
    isOnline: boolean;
    registryOrgId: string | null;
    hostOrgIds: string[];
    tags: string[];
    source: string;
    sourceUrl: string | null;
    publishedAt: Date | null;
  }
) {
  const hostNames = await resolveHostNames(ev.hostOrgIds);
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    startsAt: ev.startsAt.toISOString(),
    endsAt: ev.endsAt?.toISOString() ?? null,
    timezone: ev.timezone,
    location: ev.location,
    isOnline: ev.isOnline,
    registryOrgId: ev.registryOrgId,
    hostOrgIds: ev.hostOrgIds,
    hostOrgNames: hostNames,
    tags: ev.tags,
    source: ev.source,
    sourceUrl: ev.sourceUrl,
    publishedAt: ev.publishedAt?.toISOString() ?? null,
  };
}

export async function registerCivicEventRoutes(
  app: FastifyInstance,
  opts: { publicApi: PublicRateConfig; messageApi: PublicRateConfig }
) {
  app.get("/api/events", { ...opts.publicApi }, async (req) => {
    const q = req.query as {
      from?: string;
      to?: string;
      region?: string;
      q?: string;
      orgId?: string;
      source?: string;
    };
    const and: Record<string, unknown>[] = [{ status: "published" }];
    if (q.from) and.push({ startsAt: { gte: new Date(q.from) } });
    if (q.to) and.push({ startsAt: { lte: new Date(q.to) } });
    if (q.region) {
      and.push({ location: { contains: q.region, mode: "insensitive" } });
    }
    if (q.orgId) {
      and.push({
        OR: [{ registryOrgId: q.orgId }, { hostOrgIds: { has: q.orgId } }],
      });
    }
    if (q.source) and.push({ source: q.source });
    const needle = q.q?.trim();
    if (needle) {
      and.push({
        OR: [
          { title: { contains: needle, mode: "insensitive" } },
          { description: { contains: needle, mode: "insensitive" } },
        ],
      });
    }
    const rows = await prisma.civicEvent.findMany({
      where: { AND: and },
      orderBy: { startsAt: "asc" },
      take: 200,
    });
    const items = await Promise.all(rows.map(serializePublicEvent));
    return { items };
  });

  app.get("/api/events/:id", { ...opts.publicApi }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ev = await prisma.civicEvent.findFirst({
      where: { id, status: "published" },
    });
    if (!ev) return reply.status(404).send({ error: "Event not found" });
    return serializePublicEvent(ev);
  });

  app.get("/api/steward/events", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const status = (req.query as { status?: string }).status;
    const rows = await prisma.civicEvent.findMany({
      where: status ? { status } : undefined,
      orderBy: { startsAt: "desc" },
      take: 200,
    });
    return { items: rows };
  });

  app.get("/api/steward/events/pending", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const rows = await prisma.civicEvent.findMany({
      where: { status: "pending_review" },
      orderBy: { startsAt: "asc" },
      take: 100,
    });
    return { items: rows };
  });

  app.post("/api/steward/events", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const parsed = stewardEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const b = parsed.data;
    const status = b.status ?? "draft";
    const hostOrgIds = b.hostOrgIds ?? (b.registryOrgId ? [b.registryOrgId] : []);
    const publishedAt = status === "published" ? new Date() : null;
    const ev = await prisma.civicEvent.create({
      data: {
        title: b.title,
        description: b.description ?? "",
        startsAt: new Date(b.startsAt),
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
        timezone: b.timezone ?? "Europe/Athens",
        location: b.location,
        isOnline: b.isOnline ?? false,
        registryOrgId: b.registryOrgId ?? null,
        hostOrgIds,
        tags: b.tags ?? [],
        source: "steward",
        sourceUrl: b.sourceUrl === "" ? null : b.sourceUrl,
        status,
        publishedAt,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorKey: getActorSubject(auth),
        action: "civic_event.create",
        entityType: "CivicEvent",
        entityId: ev.id,
      },
    });
    return { ok: true, event: ev };
  });

  app.patch("/api/steward/events/:id", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const existing = await prisma.civicEvent.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    const parsed = stewardEventSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const b = parsed.data;
    const nextStatus = b.status ?? existing.status;
    let publishedAt = existing.publishedAt;
    if (nextStatus === "published" && existing.status !== "published") {
      publishedAt = new Date();
    }
    const ev = await prisma.civicEvent.update({
      where: { id },
      data: {
        title: b.title ?? existing.title,
        description: b.description ?? existing.description,
        startsAt: b.startsAt ? new Date(b.startsAt) : existing.startsAt,
        endsAt: b.endsAt === null ? null : b.endsAt ? new Date(b.endsAt) : existing.endsAt,
        timezone: b.timezone ?? existing.timezone,
        location: b.location ?? existing.location,
        isOnline: b.isOnline ?? existing.isOnline,
        registryOrgId: b.registryOrgId === null ? null : b.registryOrgId ?? existing.registryOrgId,
        hostOrgIds: b.hostOrgIds ?? existing.hostOrgIds,
        tags: b.tags ?? existing.tags,
        sourceUrl: b.sourceUrl === "" ? null : b.sourceUrl ?? existing.sourceUrl,
        status: nextStatus,
        publishedAt,
      },
    });
    return { ok: true, event: ev };
  });

  app.patch("/api/steward/events/:id/review", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const parsed = eventReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const existing = await prisma.civicEvent.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    const { action, mergeIntoId } = parsed.data;
    if (action === "reject") {
      const ev = await prisma.civicEvent.update({
        where: { id },
        data: { status: "rejected" },
      });
      return { ok: true, event: ev };
    }
    if (action === "merge" && mergeIntoId) {
      await prisma.civicEvent.update({
        where: { id },
        data: { status: "rejected", description: `${existing.description}\n\n(merged into ${mergeIntoId})` },
      });
      return { ok: true, mergedInto: mergeIntoId };
    }
    const ev = await prisma.civicEvent.update({
      where: { id },
      data: { status: "published", publishedAt: new Date(), source: existing.source === "scrape" ? "scrape" : "steward" },
    });
    await prisma.auditLog.create({
      data: {
        actorKey: getActorSubject(auth),
        action: "civic_event.publish",
        entityType: "CivicEvent",
        entityId: id,
      },
    });
    return { ok: true, event: ev };
  });

  app.get("/api/steward/event-sources", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const items = await prisma.eventScrapeSource.findMany({ orderBy: { createdAt: "desc" } });
    return { items };
  });

  app.post("/api/steward/event-sources", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const parsed = scrapeSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const b = parsed.data;
    const row = await prisma.eventScrapeSource.create({
      data: {
        type: b.type,
        url: b.url,
        registryOrgId: b.registryOrgId ?? null,
        enabled: b.enabled ?? true,
      },
    });
    return { ok: true, source: row };
  });

  app.post("/api/steward/scrape/run", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const sourceId = (req.body as { sourceId?: string })?.sourceId;
    if (sourceId) {
      const result = await runScrapeForSource(sourceId);
      return { ok: true, result };
    }
    const results = await runAllScrapeSources();
    return { ok: true, results };
  });

  app.get("/api/steward/org-members", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const orgId = (req.query as { orgId?: string }).orgId;
    const items = await prisma.orgMember.findMany({
      where: orgId ? { registryOrgId: orgId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { items };
  });

  app.post("/api/steward/org-members", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const parsed = orgMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const b = parsed.data;
    const row = await prisma.orgMember.upsert({
      where: {
        registryOrgId_clerkUserId: {
          registryOrgId: b.registryOrgId,
          clerkUserId: b.clerkUserId,
        },
      },
      update: { role: b.role ?? "contact", assignedBy: getActorSubject(auth) },
      create: {
        registryOrgId: b.registryOrgId,
        clerkUserId: b.clerkUserId,
        role: b.role ?? "contact",
        assignedBy: getActorSubject(auth),
      },
    });
    return { ok: true, member: row };
  });

  app.get("/api/org-members/me", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const items = await prisma.orgMember.findMany({ where: { clerkUserId: auth.subject } });
    const nameMap = await getRegistryOrgNameMap();
    return {
      items: items.map((m) => ({
        ...m,
        orgName: nameMap[m.registryOrgId] || m.registryOrgId,
      })),
    };
  });

  app.post("/api/events/:id/threads", { ...opts.messageApi }, async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const eventId = (req.params as { id: string }).id;
    const parsed = threadCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const gate = await requireOrgMember(auth.subject, parsed.data.registryOrgId);
    if (!gate.ok) return reply.status(403).send({ error: "Not an org member" });
    const ev = await prisma.civicEvent.findFirst({
      where: { id: eventId, status: "published" },
    });
    if (!ev) return reply.status(404).send({ error: "Event not found" });
    const participantIds = new Set<string>([
      parsed.data.registryOrgId,
      ...(parsed.data.inviteOrgIds ?? []),
      ...ev.hostOrgIds,
    ]);
    if (ev.registryOrgId) participantIds.add(ev.registryOrgId);

    const thread = await prisma.eventThread.create({
      data: {
        eventId,
        subject: parsed.data.subject,
        createdByOrgId: parsed.data.registryOrgId,
        createdByClerkUserId: auth.subject,
        participants: {
          create: [...participantIds].map((registryOrgId) => ({ registryOrgId })),
        },
      },
      include: { participants: true },
    });
    return { ok: true, thread };
  });

  app.get("/api/threads/:id", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const allowed = await isThreadParticipant(auth.subject, id);
    if (!allowed) {
      const steward = await authorizeSteward(req);
      if (!steward.ok) return reply.status(403).send({ error: "Forbidden" });
    }
    const thread = await prisma.eventThread.findUnique({
      where: { id },
      include: {
        messages: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
        participants: true,
        event: true,
      },
    });
    if (!thread) return reply.status(404).send({ error: "Not found" });
    return { thread };
  });

  app.post("/api/threads/:id/messages", { ...opts.messageApi }, async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const parsed = threadMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const gate = await requireOrgMember(auth.subject, parsed.data.registryOrgId);
    if (!gate.ok) return reply.status(403).send({ error: "Not an org member" });
    const allowed = await isThreadParticipant(auth.subject, id);
    if (!allowed) return reply.status(403).send({ error: "Not a thread participant" });
    const thread = await prisma.eventThread.findUnique({ where: { id } });
    if (!thread || thread.status !== "open") {
      return reply.status(400).send({ error: "Thread closed" });
    }
    const msg = await prisma.eventThreadMessage.create({
      data: {
        threadId: id,
        authorOrgId: parsed.data.registryOrgId,
        authorClerkUserId: auth.subject,
        body: parsed.data.body,
      },
    });
    return { ok: true, message: msg };
  });

  app.patch("/api/threads/:id", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    const steward = await authorizeSteward(req);
    const id = (req.params as { id: string }).id;
    const status = (req.body as { status?: string })?.status;
    if (status !== "closed") {
      return reply.status(400).send({ error: "Only close supported" });
    }
    if (!steward.ok) {
      if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
      const thread = await prisma.eventThread.findUnique({ where: { id } });
      if (!thread) return reply.status(404).send({ error: "Not found" });
      const gate = await requireOrgMember(auth.subject, thread.createdByOrgId);
      if (!gate.ok) return reply.status(403).send({ error: "Forbidden" });
    }
    const updated = await prisma.eventThread.update({
      where: { id },
      data: { status: "closed" },
    });
    return { ok: true, thread: updated };
  });
}
