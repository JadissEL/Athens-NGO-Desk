#!/usr/bin/env node
/**
 * Phase 3 — merge wave3_jobs_shard_*.json into job_research_seed.json (byOrgId).
 * Each shard: { "byOrgId": { "ngo-123-slug": { ... job research ... } } } or full seed-shaped object.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);
const { validateJobResearchSeed } = requireCjs("../validate_job_research_seed.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const importsDir = path.join(repoRoot, "data", "ngos", "imports");
const seedPath = path.join(repoRoot, "data", "ngos", "job_research_seed.json");

const files = fs
  .readdirSync(importsDir)
  .filter((f) => /^wave3_jobs_shard_.*\.json$/i.test(f))
  .sort();

if (!files.length) {
  console.error("No wave3_jobs_shard_*.json files found");
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
if (!seed.byOrgId) seed.byOrgId = {};
seed.meta = seed.meta || {};
seed.meta.researchedAt = new Date().toISOString();
seed.meta.method = (seed.meta.method || "") + " | wave3 shard merge";

let merged = 0;
for (const f of files) {
  const chunk = JSON.parse(fs.readFileSync(path.join(importsDir, f), "utf8"));
  const map = chunk.byOrgId || chunk;
  for (const [orgId, payload] of Object.entries(map)) {
    if (orgId === "meta") continue;
    seed.byOrgId[orgId] = { ...seed.byOrgId[orgId], ...payload };
    merged++;
  }
}

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
const check = validateJobResearchSeed();
if (!check.ok) {
  console.error("Seed schema failed after merge:", check.message);
  process.exit(1);
}
console.log(`Merged ${merged} org job blocks from ${files.length} shards. Run: npm run merge:jobs && npm run build:data`);
