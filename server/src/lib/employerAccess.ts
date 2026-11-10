import { prisma } from "./prisma.js";

export async function getEmployerForClerkUser(clerkUserId: string) {
  return prisma.hospitalityEmployer.findUnique({ where: { clerkUserId } });
}

export async function requireVerifiedEmployer(clerkUserId: string) {
  const employer = await getEmployerForClerkUser(clerkUserId);
  if (!employer) return { ok: false as const, reason: "not_registered" as const };
  if (employer.verificationStatus !== "verified") {
    return { ok: false as const, reason: "not_verified" as const, employer };
  }
  return { ok: true as const, employer };
}
