import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 86400000);
  const published = [
    {
      title: "Civic space roundtable — Athens",
      description: "NGO conveners discuss advocacy priorities for the coming quarter.",
      startsAt: inWeek,
      location: "Athens, Attica",
      hostOrgIds: [] as string[],
      source: "steward",
      status: "published",
      publishedAt: now,
    },
    {
      title: "Fundraising walk for refugee programmes",
      description: "Community fundraising with registry NGOs — verify details with hosts.",
      startsAt: new Date(now.getTime() + 14 * 86400000),
      location: "Piraeus",
      hostOrgIds: [] as string[],
      source: "steward",
      status: "published",
      publishedAt: now,
    },
    {
      title: "Volunteer onboarding session",
      description: "Orientation for new volunteers in civil society organisations.",
      startsAt: new Date(now.getTime() + 21 * 86400000),
      location: "Thessaloniki",
      isOnline: true,
      hostOrgIds: [] as string[],
      source: "steward",
      status: "published",
      publishedAt: now,
    },
  ];
  for (const p of published) {
    const exists = await prisma.civicEvent.findFirst({ where: { title: p.title } });
    if (exists) continue;
    await prisma.civicEvent.create({ data: p });
  }
  const pending = [
    {
      title: "[Scraped] Cultural heritage open day",
      description: "Pending steward review — scraped sample row.",
      startsAt: new Date(now.getTime() + 10 * 86400000),
      location: "Crete",
      source: "scrape",
      externalKey: "demo-scrape-1",
      status: "pending_review",
      scrapeMeta: { demo: true },
    },
    {
      title: "[Scraped] EEA grants info session",
      description: "Pending steward review — scraped sample row.",
      startsAt: new Date(now.getTime() + 12 * 86400000),
      location: "Online",
      isOnline: true,
      source: "scrape",
      externalKey: "demo-scrape-2",
      status: "pending_review",
      scrapeMeta: { demo: true },
    },
  ];
  for (const p of pending) {
    await prisma.civicEvent.upsert({
      where: { source_externalKey: { source: "scrape", externalKey: p.externalKey! } },
      create: p,
      update: {},
    });
  }
  const src = await prisma.eventScrapeSource.findFirst({ where: { url: "https://example.com/demo.ics" } });
  if (!src) {
    await prisma.eventScrapeSource.create({
      data: {
        type: "ics",
        url: "https://example.com/demo.ics",
        enabled: false,
      },
    });
  }
  console.log("Civic events demo seed OK.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
