#!/usr/bin/env node
/**
 * Phase 2 — enrich org profile fields on existing registry rows.
 * Batch file: array of { matchWebsite?, matchName?, sector?, scope?, focus?, notes?, nameEl? }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const requireCjs = createRequire(import.meta.url);
const { normHost, normName } = requireCjs("../registry_dedupe_utils.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const registryPath = path.join(repoRoot, "data", "ngos", "athens_greece.json");

const batchPath = process.argv[2];
if (!batchPath) {
  console.error("Usage: node scripts/national/patch_profiles.mjs <wave2_profiles_shard.json>");
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(path.resolve(batchPath), "utf8"));
const rows = Array.isArray(batch) ? batch : batch.organizations || [];
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

let patched = 0;
let missed = 0;

for (const row of rows) {
  const host = row.matchWebsite ? normHost(row.matchWebsite) : row.website ? normHost(row.website) : null;
  const nameKey = row.matchName ? normName(row.matchName) : row.name ? normName(row.name) : null;
  const org = registry.organizations.find((o) => {
    if (host && o.website && normHost(o.website) === host) return true;
    if (nameKey && normName(o.name) === nameKey) return true;
    return false;
  });
  if (!org) {
    missed++;
    console.warn("No match:", row.matchName || row.name || row.matchWebsite);
    continue;
  }
  for (const key of ["sector", "scope", "focus", "notes", "nameEl", "website"]) {
    if (row[key] != null && String(row[key]).trim()) org[key] = row[key];
  }
  patched++;
}

registry.meta.profileWave = {
  patchedAt: new Date().toISOString(),
  source: path.basename(batchPath),
  patched,
  missed,
};

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log(`Patched ${patched} orgs, ${missed} unmatched -> ${registryPath}`);
