import * as ical from "node-ical";
import type { NormalizedEvent } from "../types.js";

export async function fetchIcsEvents(url: string, registryOrgId?: string | null): Promise<NormalizedEvent[]> {
  const data = await ical.async.fromURL(url);
  const out: NormalizedEvent[] = [];
  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (!ev || ev.type !== "VEVENT") continue;
    const start = ev.start ? new Date(ev.start) : null;
    if (!start || Number.isNaN(start.getTime())) continue;
    const title = String(ev.summary || "Event").trim();
    const ends = ev.end ? new Date(ev.end) : undefined;
    out.push({
      title,
      description: ev.description ? String(ev.description).slice(0, 8000) : "",
      startsAt: start,
      endsAt: ends && !Number.isNaN(ends.getTime()) ? ends : undefined,
      location: ev.location ? String(ev.location) : undefined,
      sourceUrl: ev.url ? String(ev.url) : url,
      externalKey: `${url}::${ev.uid || title}::${start.toISOString()}`,
      registryOrgId: registryOrgId ?? undefined,
      scrapeMeta: { adapter: "ics", uid: ev.uid },
    });
  }
  return out;
}
