import { XMLParser } from "fast-xml-parser";
import type { NormalizedEvent } from "../types.js";

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function fetchRssEvents(url: string, registryOrgId?: string | null): Promise<NormalizedEvent[]> {
  const res = await fetch(url, { headers: { "User-Agent": "GreeceNGODesk-EventBot/1.0" } });
  if (!res.ok) throw new Error(`RSS fetch ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel || doc?.feed;
  const items = channel?.item
    ? Array.isArray(channel.item)
      ? channel.item
      : [channel.item]
    : channel?.entry
      ? Array.isArray(channel.entry)
        ? channel.entry
        : [channel.entry]
      : [];
  const out: NormalizedEvent[] = [];
  for (const it of items) {
    const title = String(it.title?.["#text"] ?? it.title ?? "").trim();
    if (!title) continue;
    const link = String(it.link?.["@_href"] ?? it.link ?? it.guid ?? url).trim();
    const pub =
      it.pubDate ??
      it.published ??
      it.updated ??
      it["dc:date"];
    const starts = pub ? parseDate(String(pub)) : null;
    if (!starts) continue;
    out.push({
      title,
      description: String(it.description ?? it.summary ?? "").slice(0, 8000),
      startsAt: starts,
      sourceUrl: link,
      externalKey: `rss::${link}`,
      registryOrgId: registryOrgId ?? undefined,
      scrapeMeta: { adapter: "rss" },
    });
  }
  return out;
}
