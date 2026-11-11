import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authorizeClerkSession } from "../lib/clerkSession.js";
import { DASHBOARD_TYPES, setDashboardTypeBody } from "../lib/platformSchemas.js";

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get("/api/platform/config", async () => ({
    dashboardTypes: DASHBOARD_TYPES.map((id) => ({ id, label: dashboardLabel(id) })),
  }));

  app.get("/api/platform/me", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) {
      return reply.status(401).send({ error: "Sign in required" });
    }
    const pref = await prisma.platformUserPreference.findUnique({
      where: { clerkUserId: auth.subject },
    });
    const employer = await prisma.hospitalityEmployer.findUnique({
      where: { clerkUserId: auth.subject },
      select: { id: true, verificationStatus: true, tradeName: true },
    });
    const orgCount = await prisma.orgMember.count({ where: { clerkUserId: auth.subject } });
    return {
      clerkUserId: auth.subject,
      dashboardType: pref?.dashboardType ?? null,
      hints: {
        employerRegistered: !!employer,
        employerVerificationStatus: employer?.verificationStatus ?? null,
        orgMembershipCount: orgCount,
      },
    };
  });

  app.put("/api/platform/me/dashboard", async (req, reply) => {
    const auth = await authorizeClerkSession(req);
    if (!auth.ok) {
      return reply.status(401).send({ error: "Sign in required" });
    }
    const parsed = setDashboardTypeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid body", issues: parsed.error.issues });
    }
    const row = await prisma.platformUserPreference.upsert({
      where: { clerkUserId: auth.subject },
      create: {
        clerkUserId: auth.subject,
        dashboardType: parsed.data.dashboardType,
      },
      update: { dashboardType: parsed.data.dashboardType },
    });
    return { ok: true, dashboardType: row.dashboardType };
  });
}

function dashboardLabel(id: string): string {
  switch (id) {
    case "jobseeker":
      return "Jobseeker";
    case "employer":
      return "Hospitality employer";
    case "ngo_member":
      return "NGO & events";
    case "funder":
      return "Funder";
    case "donor":
      return "Donor & supporter";
    case "steward":
      return "Desk steward";
    default:
      return id;
  }
}
