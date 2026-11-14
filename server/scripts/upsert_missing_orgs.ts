/**
 * Insert NGOs that are in data/ngos and missing from DraftBundle / PublishedBundle.
 * Does not replace existing organization records and does not delete extras.
 *
 *   cd server && npm run db:upsert:orgs
 *
 * `seed_from_json.ts --if-empty` calls this when a published bundle already exists,
 * so a normal Render build picks up new ids without a full reseed.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Prisma, PrismaClient } from "@prisma/client";
import { planBundleUpsert, type NgoBundle } from "./merge_missing_orgs.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..", "..");

const inputs = {
  registry: "athens_greece.json",
  possibility: "job_possibility.json",
  summary: "job_openings_summary.json",
  emails: "spontaneous_emails.json",
  media: "media_week.json",
} as const;

export type UpsertResult = {
  publishedAdded: string[];
  draftAdded: string[];
  skipped: "no-published-bundle" | null;
};

export function loadSourceBundle(root = repoRoot): NgoBundle {
  const dataDir = path.join(root, "data", "ngos");
  const bundle = {} as NgoBundle;
  for (const [key, filename] of Object.entries(inputs)) {
    const fp = path.join(dataDir, filename);
    if (!fs.existsSync(fp)) {
      throw new Error(`Missing file: ${fp}`);
    }
    bundle[key as keyof NgoBundle] = JSON.parse(fs.readFileSync(fp, "utf8"));
  }
  return bundle;
}

function rowToBundle(row: {
  registry: unknown;
  possibility: unknown;
  summary: unknown;
  emails: unknown;
  media: unknown;
}): NgoBundle {
  return {
    registry: row.registry,
    possibility: row.possibility,
    summary: row.summary,
    emails: row.emails,
    media: row.media,
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function upsertMissingOrgs(
  prisma: PrismaClient,
  source?: NgoBundle
): Promise<UpsertResult> {
  const incoming = source ?? loadSourceBundle();
  const published = await prisma.publishedBundle.findUnique({ where: { id: 1 } });
  if (!published) {
    return { publishedAdded: [], draftAdded: [], skipped: "no-published-bundle" };
  }
  const draft = await prisma.draftBundle.findUnique({ where: { id: 1 } });
  const publishedPlan = planBundleUpsert(rowToBundle(published), incoming);
  const draftPlan = draft ? planBundleUpsert(rowToBundle(draft), incoming) : null;
  const draftAdded = draftPlan?.addedIds ?? [];

  if (publishedPlan.addedIds.length === 0 && draftAdded.length === 0) {
    return { publishedAdded: [], draftAdded: [], skipped: null };
  }

  await prisma.$transaction(async (tx) => {
    if (publishedPlan.addedIds.length > 0) {
      await tx.publishedBundle.update({
        where: { id: 1 },
        data: {
          registry: jsonValue(publishedPlan.bundle.registry),
          possibility: jsonValue(publishedPlan.bundle.possibility),
          summary: jsonValue(publishedPlan.bundle.summary),
          emails: jsonValue(publishedPlan.bundle.emails),
          publishedAt: new Date(),
        },
      });
    }
    if (draft && draftPlan && draftPlan.addedIds.length > 0) {
      await tx.draftBundle.update({
        where: { id: 1 },
        data: {
          registry: jsonValue(draftPlan.bundle.registry),
          possibility: jsonValue(draftPlan.bundle.possibility),
          summary: jsonValue(draftPlan.bundle.summary),
          emails: jsonValue(draftPlan.bundle.emails),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorKey: "upsert_missing_orgs",
        action: "upsert_missing_orgs",
        entityType: "PublishedBundle",
        entityId: "1",
        detail: {
          source: "data/ngos",
          mode: "insert-missing-ids",
          publishedAdded: publishedPlan.addedIds,
          draftAdded,
        },
      },
    });
  });

  return {
    publishedAdded: publishedPlan.addedIds,
    draftAdded,
    skipped: null,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await upsertMissingOrgs(prisma);
    if (result.skipped === "no-published-bundle") {
      console.error(
        "No PublishedBundle id=1. Seed an empty database with npm run db:seed. This command will not replace an existing bundle."
      );
      process.exitCode = 1;
      return;
    }
    if (result.publishedAdded.length === 0 && result.draftAdded.length === 0) {
      console.log("upsert_missing_orgs: no new organization ids");
      return;
    }
    console.log(
      `upsert_missing_orgs: published=[${result.publishedAdded.join(", ")}] draft=[${result.draftAdded.join(", ")}]`
    );
  } finally {
    await prisma.$disconnect();
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
