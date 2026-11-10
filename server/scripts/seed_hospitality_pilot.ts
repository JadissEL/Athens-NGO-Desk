/**
 * Pilot hospitality employers + published jobs (dev / demo).
 * Run: cd server && npx tsx scripts/seed_hospitality_pilot.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PILOT = [
  {
    slug: "aegean-bay-hotel",
    legalName: "Aegean Bay Hotel IKE",
    tradeName: "Aegean Bay Hotel",
    employerType: "hotel",
    region: "Attica",
    contactEmail: "careers@example-hotel.test",
    clerkUserId: "pilot_clerk_aegean_bay",
    jobs: [
      {
        title: "Housekeeping team member (seasonal)",
        location: "Athens, Attica",
        contractType: "seasonal",
        languagesRequired: ["Greek"],
        languagesPreferred: ["English"],
        seasonality: "Apr–Oct",
        fairHireFlags: { trainingProvided: true, noExperienceRequired: true },
        description:
          "Entry-friendly seasonal housekeeping on the Athens riviera. Training on the job. Fair scheduling.",
      },
    ],
  },
  {
    slug: "cyclades-tours",
    legalName: "Cyclades Tours EPE",
    tradeName: "Cyclades Tours",
    employerType: "tour_operator",
    region: "South Aegean",
    contactEmail: "hr@example-tours.test",
    clerkUserId: "pilot_clerk_cyclades",
    jobs: [
      {
        title: "Tour coordinator assistant",
        location: "Piraeus, Attica",
        contractType: "fixed-term",
        languagesRequired: ["English"],
        languagesPreferred: ["Greek", "French"],
        seasonality: "May–Sep",
        fairHireFlags: { trainingProvided: true },
        description: "Support island tour departures. Multilingual welcome desk.",
      },
    ],
  },
  {
    slug: "ionian-kitchen-group",
    legalName: "Ionian Kitchen Group",
    tradeName: "Ionian Kitchen Group",
    employerType: "restaurant_group",
    region: "Attica",
    contactEmail: "jobs@example-kitchen.test",
    clerkUserId: "pilot_clerk_ionian",
    jobs: [
      {
        title: "Kitchen helper — tourist season",
        location: "Plaka, Athens",
        contractType: "seasonal",
        languagesRequired: [],
        languagesPreferred: ["Greek", "English", "Albanian"],
        fairHireFlags: { noExperienceRequired: true, trainingProvided: true },
        description: "Prep and service support for busy summer service.",
      },
    ],
  },
  {
    slug: "crete-hospitality-services",
    legalName: "Crete Hospitality Services IKE",
    tradeName: "Crete Hospitality Services",
    employerType: "hotel",
    region: "Crete",
    contactEmail: "recruit@example-crete.test",
    clerkUserId: "pilot_clerk_crete",
    jobs: [
      {
        title: "Receptionist (night shift cover)",
        location: "Heraklion, Crete",
        contractType: "full-time",
        languagesRequired: ["Greek", "English"],
        languagesPreferred: ["German"],
        description: "Front desk for boutique property. Experience helpful, not mandatory.",
      },
    ],
  },
  {
    slug: "attica-marina-tours",
    legalName: "Attica Marina Tours",
    tradeName: "Attica Marina Tours",
    employerType: "tour_operator",
    region: "Attica",
    contactEmail: "team@example-marina.test",
    clerkUserId: "pilot_clerk_marina",
    jobs: [
      {
        title: "Boat excursion host",
        location: "Marina Zea, Piraeus",
        contractType: "seasonal",
        languagesRequired: ["English"],
        languagesPreferred: ["Greek"],
        seasonality: "Jun–Sep",
        fairHireFlags: { trainingProvided: true },
        description: "Guest safety briefing and service on daily cruises.",
      },
    ],
  },
];

async function main() {
  const now = new Date();
  for (const pack of PILOT) {
    const employer = await prisma.hospitalityEmployer.upsert({
      where: { slug: pack.slug },
      update: {
        legalName: pack.legalName,
        tradeName: pack.tradeName,
        verificationStatus: "verified",
      },
      create: {
        slug: pack.slug,
        legalName: pack.legalName,
        tradeName: pack.tradeName,
        employerType: pack.employerType,
        region: pack.region,
        contactEmail: pack.contactEmail,
        clerkUserId: pack.clerkUserId,
        verificationStatus: "verified",
      },
    });
    for (const j of pack.jobs) {
      const exists = await prisma.hospitalityJob.findFirst({
        where: { employerId: employer.id, title: j.title },
      });
      if (exists) continue;
      await prisma.hospitalityJob.create({
        data: {
          employerId: employer.id,
          title: j.title,
          description: j.description,
          location: j.location,
          contractType: j.contractType,
          languagesRequired: j.languagesRequired,
          languagesPreferred: j.languagesPreferred ?? [],
          seasonality: j.seasonality,
          fairHireFlags: j.fairHireFlags ?? undefined,
          status: "published",
          publishedAt: now,
        },
      });
    }
  }
  const count = await prisma.hospitalityJob.count({ where: { status: "published" } });
  console.log(`Hospitality pilot seed OK — ${count} published job(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
