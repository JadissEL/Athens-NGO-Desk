import type { NormalizedEvent } from "../types.js";

const DATE_RE =
  /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/;

export async function fetchHtmlListEvents(
  url: string,
  registryOrgId?: string | null
): Promise<NormalizedEvent[]> {
  const res = await fetch(url, { headers: { "User-Agent": "GreeceNGODesk-EventBot/1.0" } });
  if (!res.ok) throw new Error(`HTML fetch ${res.status}`);
  const html = await res.text();
  const out: NormalizedEvent[] = [];
  const blocks = html.split(/<h[23][^>]*>/i).slice(1);
  for (const block of blocks.slice(0, 40)) {
    const titleMatch = /^([^<]+)/.exec(block);
    const title = titleMatch ? titleMatch[1].trim() : "";
    if (title.length < 4) continue;
    const dateMatch = DATE_RE.exec(block);
    if (!dateMatch) continue;
    const [, y, mo, d, h, mi] = dateMatch;
    const starts = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      h ? Number(h) : 12,
      mi ? Number(mi) : 0
    );
    if (Number.isNaN(starts.getTime())) continue;
    out.push({
      title: title.slice(0, 300),
      description: block.replace(/<[^>]+>/g, " ").slice(0, 2000),
      startsAt: starts,
      sourceUrl: url,
      externalKey: `html::${url}::${title}::${starts.toISOString()}`,
      registryOrgId: registryOrgId ?? undefined,
      scrapeMeta: { adapter: "html_list" },
    });
  }
  return out;
}
