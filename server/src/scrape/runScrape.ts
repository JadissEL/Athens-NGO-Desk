import { prisma } from "../lib/prisma.js";
import type { ScrapeAdapter } from "./types.js";
import { fetchIcsEvents } from "./adapters/ics.js";
import { fetchRssEvents } from "./adapters/rss.js";
import { fetchHtmlListEvents } from "./adapters/html_list.js";
import { fetchEventbriteEvents } from "./adapters/eventbrite.js";
import { fetchFacebookEvents } from "./adapters/facebook.js";

const adapters: Record<string, ScrapeAdapter> = {
  ics: { type: "ics", fetch: fetchIcsEvents },
  rss: { type: "rss", fetch: fetchRssEvents },
  html_list: { type: "html_list", fetch: fetchHtmlListEvents },
  public_calendar: { type: "public_calendar", fetch: fetchHtmlListEvents },
  other: { type: "other", fetch: fetchHtmlListEvents },
  eventbrite: { type: "eventbrite", fetch: fetchEventbriteEvents },
  facebook: { type: "facebook", fetch: fetchFacebookEvents },
};

async function upsertScrapedEvent(
  norm: Awaited<ReturnType<ScrapeAdapter["fetch"]>>[number],
  sourceType: string
) {
  const hostOrgIds = norm.registryOrgId ? [norm.registryOrgId] : [];
  const existing = norm.externalKey
    ? await prisma.civicEvent.findUnique({
        where: { source_externalKey: { source: "scrape", externalKey: norm.externalKey } },
      })
    : null;
  if (existing) {
    await prisma.civicEvent.update({
      where: { id: existing.id },
      data: {
        title: norm.title,
        description: norm.description ?? existing.description,
        startsAt: norm.startsAt,
        endsAt: norm.endsAt,
        location: norm.location,
        sourceUrl: norm.sourceUrl,
        scrapeMeta: norm.scrapeMeta ? (norm.scrapeMeta as object) : undefined,
        hostOrgIds: hostOrgIds.length ? hostOrgIds : existing.hostOrgIds,
      },
    });
    return "updated" as const;
  }
  await prisma.civicEvent.create({
    data: {
      title: norm.title,
      description: norm.description ?? "",
      startsAt: norm.startsAt,
      endsAt: norm.endsAt,
      location: norm.location,
      isOnline: norm.isOnline ?? false,
      registryOrgId: norm.registryOrgId,
      hostOrgIds,
      source: "scrape",
      sourceUrl: norm.sourceUrl,
      externalKey: norm.externalKey,
      status: "pending_review",
      scrapeMeta: { ...(norm.scrapeMeta || {}), sourceType } as object,
    },
  });
  return "inserted" as const;
}

export async function runScrapeForSource(sourceId: string) {
  const source = await prisma.eventScrapeSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.enabled) {
    throw new Error("Source not found or disabled");
  }
  const adapter = adapters[source.type];
  if (!adapter) throw new Error(`Unknown adapter: ${source.type}`);

  const run = await prisma.eventScrapeRun.create({
    data: { sourceId: source.id, startedAt: new Date() },
  });
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  try {
    const events = await adapter.fetch(source.url, source.registryOrgId);
    for (const ev of events) {
      try {
        const r = await upsertScrapedEvent(ev, source.type);
        if (r === "inserted") inserted += 1;
        else updated += 1;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    await prisma.eventScrapeSource.update({
      where: { id: source.id },
      data: { lastRunAt: new Date(), lastError: errors.length ? errors.slice(0, 3).join("; ") : null },
    });
    await prisma.eventScrapeRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        found: events.length,
        inserted,
        updated,
        errors: errors.length ? errors : undefined,
      },
    });
    return { found: events.length, inserted, updated, errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.eventScrapeSource.update({
      where: { id: source.id },
      data: { lastRunAt: new Date(), lastError: msg },
    });
    await prisma.eventScrapeRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), errors: [msg] },
    });
    throw e;
  }
}

export async function runAllScrapeSources() {
  const sources = await prisma.eventScrapeSource.findMany({ where: { enabled: true } });
  const results = [];
  for (const s of sources) {
    try {
      results.push({ sourceId: s.id, ...(await runScrapeForSource(s.id)) });
    } catch (e) {
      results.push({
        sourceId: s.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
