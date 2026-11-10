import { prisma } from "./prisma.js";

let cache: { at: number; map: Record<string, string> } | null = null;
const TTL_MS = 60_000;

export async function getRegistryOrgNameMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.map;
  const row = await prisma.publishedBundle.findUnique({ where: { id: 1 } });
  const map: Record<string, string> = {};
  if (row?.registry && typeof row.registry === "object") {
    const orgs = (row.registry as { organizations?: unknown[] }).organizations;
    if (Array.isArray(orgs)) {
      for (const o of orgs) {
        if (o && typeof o === "object") {
          const rec = o as { id?: string; name?: string };
          if (rec.id && rec.name) map[rec.id] = rec.name;
        }
      }
    }
  }
  cache = { at: now, map };
  return map;
}

export async function resolveHostNames(ids: string[]): Promise<string[]> {
  const map = await getRegistryOrgNameMap();
  return ids.map((id) => map[id] || id);
}
