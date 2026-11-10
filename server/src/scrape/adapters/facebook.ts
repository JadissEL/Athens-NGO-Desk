import type { NormalizedEvent } from "../types.js";

/** Facebook Graph API only — requires FACEBOOK_GRAPH_TOKEN and ENABLE_FACEBOOK_SCRAPE=1 */
export async function fetchFacebookEvents(
  pageIdOrUrl: string,
  registryOrgId?: string | null
): Promise<NormalizedEvent[]> {
  if (process.env.ENABLE_FACEBOOK_SCRAPE !== "1") {
    throw new Error("Facebook scrape disabled (set ENABLE_FACEBOOK_SCRAPE=1 + legal review)");
  }
  const token = process.env.FACEBOOK_GRAPH_TOKEN?.trim();
  if (!token) throw new Error("FACEBOOK_GRAPH_TOKEN missing — no blind HTML scrape");

  let pageId = pageIdOrUrl;
  if (pageIdOrUrl.startsWith("http")) {
    try {
      const u = new URL(pageIdOrUrl);
      pageId = u.pathname.split("/").filter(Boolean)[0] || pageIdOrUrl;
    } catch {
      /* keep */
    }
  }
  const api = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/events?fields=id,name,description,start_time,end_time,place&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error(`Facebook Graph ${res.status}`);
  const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const events = data.data || [];
  return events.map((ev) => ({
    title: String(ev.name || "Event"),
    description: String(ev.description || "").slice(0, 8000),
    startsAt: new Date(String(ev.start_time)),
    endsAt: ev.end_time ? new Date(String(ev.end_time)) : undefined,
    location:
      ev.place && typeof ev.place === "object"
        ? String((ev.place as { name?: string }).name || "")
        : undefined,
    sourceUrl: `https://www.facebook.com/events/${ev.id}`,
    externalKey: `facebook::${ev.id}`,
    registryOrgId: registryOrgId ?? undefined,
    scrapeMeta: { adapter: "facebook", id: ev.id },
  }));
}
