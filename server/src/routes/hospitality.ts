import type { FastifyInstance, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { prisma } from "../lib/prisma.js";
import { authorizeClerkSession } from "../lib/clerkSession.js";
import { authorizeSteward, getActorSubject } from "../lib/auth.js";
import {
  applicationSchema,
  applicationStatusSchema,
  employerRegisterSchema,
  jobUpsertSchema,
  slugifyTradeName,
  stewardVerificationSchema,
} from "../lib/hospitalitySchemas.js";
import { getEmployerForClerkUser, requireVerifiedEmployer } from "../lib/employerAccess.js";
import { readCvBuffer, storeCvBuffer } from "../lib/cvStorage.js";

type PublicRateConfig = { config: { rateLimit: { max: number; timeWindow: string } } };

function clientMeta(req: FastifyRequest) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const ua = (req.headers["user-agent"] as string | undefined) || null;
  return { clientIp: ip, userAgent: ua };
}

function serializePublicJob(
  job: {
    id: string;
    title: string;
    description: string;
    location: string;
    contractType: string | null;
    languagesRequired: string[];
    languagesPreferred: string[];
    seasonality: string | null;
    payBandText: string | null;
    fairHireFlags: unknown;
    publishedAt: Date | null;
    closesAt: Date | null;
    employer: { tradeName: string; slug: string; employerType: string; region: string | null };
  }
) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    location: job.location,
    contractType: job.contractType,
    languagesRequired: job.languagesRequired,
    languagesPreferred: job.languagesPreferred,
    seasonality: job.seasonality,
    payBandText: job.payBandText,
    fairHireFlags: job.fairHireFlags,
    publishedAt: job.publishedAt?.toISOString() ?? null,
    closesAt: job.closesAt?.toISOString() ?? null,
    employerDisplayName: job.employer.tradeName,
    employerSlug: job.employer.slug,
    employerType: job.employer.employerType,
    employerRegion: job.employer.region,
  };
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 0;
  while (true) {
    const exists = await prisma.hospitalityEmployer.findUnique({ where: { slug } });
    if (!exists) return slug;
    n += 1;
    slug = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}

export async function registerHospitalityRoutes(
  app: FastifyInstance,
  opts: { publicApi: PublicRateConfig; applyApi: PublicRateConfig }
) {
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  app.get("/api/hospitality/jobs", { ...opts.publicApi }, async (req) => {
    const q = req.query as { region?: string; q?: string; language?: string };
    const and: Record<string, unknown>[] = [{ status: "published" }];
    const region = q.region?.trim();
    if (region) {
      and.push({ location: { contains: region, mode: "insensitive" } });
    }
    const needle = q.q?.trim();
    if (needle) {
      and.push({
        OR: [
          { title: { contains: needle, mode: "insensitive" } },
          { description: { contains: needle, mode: "insensitive" } },
          { location: { contains: needle, mode: "insensitive" } },
          { employer: { tradeName: { contains: needle, mode: "insensitive" } } },
        ],
      });
    }
    const lang = q.language?.trim();
    if (lang) {
      and.push({ languagesRequired: { has: lang } });
    }
    const rows = await prisma.hospitalityJob.findMany({
      where: { AND: and },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        employer: { select: { tradeName: true, slug: true, employerType: true, region: true } },
      },
    });
    return { items: rows.map(serializePublicJob) };
  });

  app.get("/api/hospitality/jobs/:id", { ...opts.publicApi }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = await prisma.hospitalityJob.findFirst({
      where: { id, status: "published" },
      include: {
        employer: { select: { tradeName: true, slug: true, employerType: true, region: true } },
      },
    });
    if (!job) return reply.status(404).send({ error: "Job not found" });
    return serializePublicJob(job);
  });

  app.post(
    "/api/hospitality/applications/cv-upload",
    { ...opts.applyApi },
    async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.status(400).send({ error: "File required" });
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buf = Buffer.concat(chunks);
      try {
        const { storageKey } = await storeCvBuffer(data.filename, buf);
        return { storageKey };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: msg });
      }
    }
  );

  app.post("/api/hospitality/applications", { ...opts.applyApi }, async (req, reply) => {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const body = parsed.data;
    const job = await prisma.hospitalityJob.findFirst({
      where: { id: body.jobId, status: "published" },
      include: { employer: true },
    });
    if (!job) return reply.status(404).send({ error: "Job not found or not accepting applications" });
    const meta = clientMeta(req);
    const row = await prisma.jobApplication.create({
      data: {
        jobId: body.jobId,
        seekerName: body.seekerName,
        seekerEmail: body.seekerEmail,
        seekerPhone: body.seekerPhone,
        languages: body.languages ?? [],
        workAuthorization: body.workAuthorization,
        residenceRegion: body.residenceRegion,
        coverMessage: body.coverMessage,
        cvStorageKey: body.cvStorageKey,
        gdprConsentAt: new Date(),
        clientIp: meta.clientIp,
        userAgent: meta.userAgent,
      },
    });
    return { ok: true, applicationId: row.id };
  });

  app.get("/api/hospitality/employer/me", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const employer = await getEmployerForClerkUser(auth.subject);
    if (!employer) return { registered: false };
    return {
      registered: true,
      employer: {
        id: employer.id,
        slug: employer.slug,
        legalName: employer.legalName,
        tradeName: employer.tradeName,
        employerType: employer.employerType,
        region: employer.region,
        verificationStatus: employer.verificationStatus,
        contactEmail: employer.contactEmail,
        website: employer.website,
      },
    };
  });

  app.post("/api/hospitality/employer/register", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const parsed = employerRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const body = parsed.data;
    const existing = await getEmployerForClerkUser(auth.subject);
    const website = body.website === "" ? null : body.website;
    if (existing) {
      const updated = await prisma.hospitalityEmployer.update({
        where: { id: existing.id },
        data: {
          legalName: body.legalName,
          tradeName: body.tradeName,
          employerType: body.employerType,
          region: body.region,
          address: body.address,
          website,
          contactEmail: body.contactEmail,
          afm: body.afm,
        },
      });
      return { ok: true, employerId: updated.id, verificationStatus: updated.verificationStatus };
    }
    const slug = await uniqueSlug(slugifyTradeName(body.tradeName));
    const created = await prisma.hospitalityEmployer.create({
      data: {
        slug,
        legalName: body.legalName,
        tradeName: body.tradeName,
        employerType: body.employerType,
        region: body.region,
        address: body.address,
        website,
        contactEmail: body.contactEmail,
        afm: body.afm,
        clerkUserId: auth.subject,
      },
    });
    return { ok: true, employerId: created.id, verificationStatus: created.verificationStatus };
  });

  app.get("/api/hospitality/employer/jobs", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const employer = await getEmployerForClerkUser(auth.subject);
    if (!employer) return reply.status(404).send({ error: "Employer not registered" });
    const jobs = await prisma.hospitalityJob.findMany({
      where: { employerId: employer.id },
      orderBy: { updatedAt: "desc" },
    });
    return { items: jobs };
  });

  app.post("/api/hospitality/employer/jobs", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const gate = await requireVerifiedEmployer(auth.subject);
    if (!gate.ok) {
      if (gate.reason === "not_registered") {
        return reply.status(404).send({ error: "Employer not registered" });
      }
      return reply.status(403).send({ error: "Employer not verified" });
    }
    const parsed = jobUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const body = parsed.data;
    const status = body.status ?? "draft";
    const publishedAt = status === "published" ? new Date() : null;
    const job = await prisma.hospitalityJob.create({
      data: {
        employerId: gate.employer.id,
        title: body.title,
        description: body.description ?? "",
        location: body.location,
        contractType: body.contractType,
        languagesRequired: body.languagesRequired ?? [],
        languagesPreferred: body.languagesPreferred ?? [],
        seasonality: body.seasonality,
        payBandText: body.payBandText,
        fairHireFlags: body.fairHireFlags ?? undefined,
        status,
        publishedAt,
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
      },
    });
    return { ok: true, job };
  });

  app.patch("/api/hospitality/employer/jobs/:id", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const gate = await requireVerifiedEmployer(auth.subject);
    if (!gate.ok) {
      return reply.status(gate.reason === "not_registered" ? 404 : 403).send({
        error: gate.reason === "not_registered" ? "Employer not registered" : "Employer not verified",
      });
    }
    const id = (req.params as { id: string }).id;
    const existing = await prisma.hospitalityJob.findFirst({
      where: { id, employerId: gate.employer.id },
    });
    if (!existing) return reply.status(404).send({ error: "Job not found" });
    const parsed = jobUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const body = parsed.data;
    const nextStatus = body.status ?? existing.status;
    let publishedAt = existing.publishedAt;
    if (nextStatus === "published" && existing.status !== "published") {
      publishedAt = new Date();
    }
    const job = await prisma.hospitalityJob.update({
      where: { id },
      data: {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        location: body.location ?? existing.location,
        contractType: body.contractType ?? existing.contractType,
        languagesRequired: body.languagesRequired ?? existing.languagesRequired,
        languagesPreferred: body.languagesPreferred ?? existing.languagesPreferred,
        seasonality: body.seasonality ?? existing.seasonality,
        payBandText: body.payBandText ?? existing.payBandText,
        fairHireFlags:
          body.fairHireFlags !== undefined
            ? (body.fairHireFlags as object)
            : existing.fairHireFlags === null
              ? undefined
              : (existing.fairHireFlags as object),
        status: nextStatus,
        publishedAt,
        closesAt:
          body.closesAt === null
            ? null
            : body.closesAt
              ? new Date(body.closesAt)
              : existing.closesAt,
      },
    });
    return { ok: true, job };
  });

  app.get("/api/hospitality/employer/applications", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const employer = await getEmployerForClerkUser(auth.subject);
    if (!employer) return reply.status(404).send({ error: "Employer not registered" });
    if (employer.verificationStatus === "suspended") {
      return reply.status(403).send({ error: "Employer suspended" });
    }
    const jobId = (req.query as { jobId?: string }).jobId?.trim();
    const jobFilter = jobId
      ? { id: jobId, employerId: employer.id }
      : { employerId: employer.id };
    const jobs = await prisma.hospitalityJob.findMany({
      where: jobFilter,
      select: { id: true },
    });
    const jobIds = jobs.map((j) => j.id);
    if (!jobIds.length) return { items: [] };
    const items = await prisma.jobApplication.findMany({
      where: { jobId: { in: jobIds } },
      orderBy: { createdAt: "desc" },
      include: { job: { select: { title: true, id: true } } },
    });
    return {
      items: items.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        jobTitle: a.job.title,
        seekerName: a.seekerName,
        seekerEmail: a.seekerEmail,
        seekerPhone: a.seekerPhone,
        languages: a.languages,
        workAuthorization: a.workAuthorization,
        residenceRegion: a.residenceRegion,
        coverMessage: a.coverMessage,
        hasCv: !!a.cvStorageKey,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  app.patch("/api/hospitality/employer/applications/:id", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const employer = await getEmployerForClerkUser(auth.subject);
    if (!employer) return reply.status(404).send({ error: "Employer not registered" });
    const id = (req.params as { id: string }).id;
    const parsed = applicationStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const appRow = await prisma.jobApplication.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!appRow || appRow.job.employerId !== employer.id) {
      return reply.status(404).send({ error: "Application not found" });
    }
    const updated = await prisma.jobApplication.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return { ok: true, application: updated };
  });

  app.get("/api/hospitality/employer/applications/:id/cv", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const employer = await getEmployerForClerkUser(auth.subject);
    if (!employer) return reply.status(404).send({ error: "Employer not registered" });
    const id = (req.params as { id: string }).id;
    const appRow = await prisma.jobApplication.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!appRow || appRow.job.employerId !== employer.id) {
      return reply.status(404).send({ error: "Application not found" });
    }
    if (!appRow.cvStorageKey) return reply.status(404).send({ error: "No CV on file" });
    try {
      const buf = await readCvBuffer(appRow.cvStorageKey);
      const ext = appRow.cvStorageKey.includes(".") ? appRow.cvStorageKey.split(".").pop() : "bin";
      const type =
        ext === "pdf"
          ? "application/pdf"
          : ext === "txt"
            ? "text/plain"
            : "application/octet-stream";
      return reply
        .header("Content-Type", type)
        .header("Content-Disposition", `attachment; filename="cv-${id}.${ext}"`)
        .send(buf);
    } catch {
      return reply.status(404).send({ error: "CV file missing" });
    }
  });

  app.patch("/api/hospitality/steward/employers/:id/verification", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const parsed = stewardVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const employer = await prisma.hospitalityEmployer.findUnique({ where: { id } });
    if (!employer) return reply.status(404).send({ error: "Employer not found" });
    const updated = await prisma.hospitalityEmployer.update({
      where: { id },
      data: { verificationStatus: parsed.data.verificationStatus },
    });
    await prisma.auditLog.create({
      data: {
        actorKey: getActorSubject(auth),
        action: "hospitality.employer.verification",
        entityType: "HospitalityEmployer",
        entityId: id,
        detail: { verificationStatus: parsed.data.verificationStatus },
      },
    });
    return { ok: true, employer: updated };
  });

  app.get("/api/hospitality/steward/employers", async (req, reply) => {
    const auth = await authorizeSteward(req);
    if (!auth.ok) return reply.status(401).send({ error: "Unauthorized" });
    const status = (req.query as { status?: string }).status;
    const employers = await prisma.hospitalityEmployer.findMany({
      where: status ? { verificationStatus: status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items: employers };
  });
}
