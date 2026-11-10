import type { NormalizedEvent } from "../types.js";

/** Official Eventbrite API — requires EVENTBRITE_API_TOKEN and ENABLE_EVENTBRITE_SCRAPE=1 */
export async function fetchEventbriteEvents(
  url: string,
  registryOrgId?: string | null
): Promise<NormalizedEvent[]> {
  if (process.env.ENABLE_EVENTBRITE_SCRAPE !== "1") {
    throw new Error("Eventbrite scrape disabled (set ENABLE_EVENTBRITE_SCRAPE=1)");
  }
  const token = process.env.EVENTBRITE_API_TOKEN?.trim();
  if (!token) throw new Error("EVENTBRITE_API_TOKEN missing");

  let orgId = "";
  try {
    const u = new URL(url);
    orgId = u.searchParams.get("organization_id") || u.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    orgId = url;
  }
  const api = `https://www.eventbriteapi.com/v3/organizations/${encodeURIComponent(orgId)}/events/?status=live`;
  const res = await fetch(api, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Eventbrite API ${res.status}`);
  const data = (await res.json()) as { events?: Array<Record<string, unknown>> };
  const events = data.events || [];
  return events.map((ev) => {
    const start = ev.start ? new Date(String((ev.start as { utc?: string }).utc || ev.start)) : new Date();
    const nameObj = ev.name as { text?: string } | string | undefined;
    const descObj = ev.description as { text?: string } | string | undefined;
    return {
      title: String(typeof nameObj === "object" && nameObj?.text ? nameObj.text : nameObj ?? "Event"),
      description: String(
        typeof descObj === "object" && descObj?.text ? descObj.text : descObj ?? ""
      ).slice(0, 8000),
      startsAt: start,
      sourceUrl: String(ev.url ?? url),
      externalKey: `eventbrite::${ev.id}`,
      registryOrgId: registryOrgId ?? undefined,
      scrapeMeta: { adapter: "eventbrite", id: ev.id },
    } satisfies NormalizedEvent;
  });
}
