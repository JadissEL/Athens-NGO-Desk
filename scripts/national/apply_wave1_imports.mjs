#!/usr/bin/env node
/**
 * Apply every wave1 shard import file (Phase 1 — discover NGOs).
 * Usage: node scripts/national/apply_wave1_imports.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const importsDir = path.join(repoRoot, "data", "ngos", "imports");

const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");

const files = fs
  .readdirSync(importsDir)
  .filter((f) => /^wave1_shard_.*\.json$/i.test(f))
  .sort();

if (!files.length) {
  console.error("No wave1_shard_*.json files in data/ngos/imports/");
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  const fp = path.join(importsDir, f);
  const rows = JSON.parse(fs.readFileSync(fp, "utf8"));
  const n = Array.isArray(rows) ? rows.length : rows.organizations?.length ?? 0;
  console.log(`${dryRun ? "[dry-run] " : ""}${f} (${n} rows)`);
  const args = dryRun ? ["--dry-run", fp] : [fp];
  const r = spawnSync("node", ["scripts/import_registry_rows.js", ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) failed++;
}

if (failed) process.exit(failed);
console.log("Wave1 apply complete. Next: npm run audit:registry-duplicates && npm run validate && npm run build:data");
