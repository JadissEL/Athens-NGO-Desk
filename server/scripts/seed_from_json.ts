/**
 * Loads data/ngos/*.json into DraftBundle and PublishedBundle (id=1).
 * Run from repo: cd server && npx tsx scripts/seed_from_json.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.join(__dirname, "..");
const repoRoot = path.join(serverRoot, "..");
const dataDir = path.join(repoRoot, "data", "ngos");

const inputs = {
  registry: "athens_greece.json",
  possibility: "job_possibility.json",
  summary: "job_openings_summary.json",
  emails: "spontaneous_emails.json",
  media: "media_week.json",
} as const;

const requireCjs = createRequire(import.meta.url);
const { validateNgoDataBundle } = requireCjs(
  path.join(repoRoot, "scripts", "validate_data_schemas.js")
) as {
  validateNgoDataBundle: (data: Record<string, unknown>) => { ok: boolean; message?: string };
};

function loadBundle() {
  const data: Record<string, unknown> = {};
  for (const [key, filename] of Object.entries(inputs)) {
    const fp = path.join(dataDir, filename);
    if (!fs.existsSync(fp)) {
      throw new Error(`Missing file: ${fp}`);
    }
    data[key] = JSON.parse(fs.readFileSync(fp, "utf8"));
  }
  const result = validateNgoDataBundle(data);
  if (!result.ok) {
    throw new Error(`Schema validation failed:\n${result.message}`);
  }
  return data as {
    registry: unknown;
    possibility: unknown;
    summary: unknown;
    emails: unknown;
    media: unknown;
  };
}

async function main() {
  const bundle = loadBundle();
  const prisma = new PrismaClient();
  const now = new Date();
  await prisma.draftBundle.upsert({
    where: { id: 1 },
    update: bundle,
    create: { id: 1, ...bundle },
  });
  await prisma.publishedBundle.upsert({
    where: { id: 1 },
    update: { ...bundle, publishedAt: now },
    create: { id: 1, ...bundle, publishedAt: now },
  });
  await prisma.auditLog.create({
    data: {
      actorKey: "seed_from_json",
      action: "seed_from_json",
      entityType: "PublishedBundle",
      entityId: "1",
      detail: { source: "data/ngos" },
    },
  });
  console.log("Seed OK: DraftBundle + PublishedBundle id=1");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
