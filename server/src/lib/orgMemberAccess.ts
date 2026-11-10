import { prisma } from "./prisma.js";

export async function listOrgMemberships(clerkUserId: string) {
  return prisma.orgMember.findMany({ where: { clerkUserId } });
}

export async function requireOrgMember(clerkUserId: string, registryOrgId?: string) {
  const rows = await listOrgMemberships(clerkUserId);
  if (!rows.length) return { ok: false as const, reason: "not_member" as const };
  if (registryOrgId) {
    const match = rows.find((r) => r.registryOrgId === registryOrgId);
    if (!match) return { ok: false as const, reason: "wrong_org" as const };
    return { ok: true as const, memberships: rows, active: match };
  }
  return { ok: true as const, memberships: rows, active: rows[0] };
}

export async function isThreadParticipant(clerkUserId: string, threadId: string) {
  const memberships = await listOrgMemberships(clerkUserId);
  const orgIds = memberships.map((m) => m.registryOrgId);
  if (!orgIds.length) return false;
  const row = await prisma.eventThreadParticipant.findFirst({
    where: { threadId, registryOrgId: { in: orgIds } },
  });
  return !!row;
}
