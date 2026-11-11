#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const importsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "ngos", "imports");
const registryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "ngos", "athens_greece.json");

const reg = JSON.parse(fs.readFileSync(registryPath, "utf8"));
console.log("Registry orgs:", reg.organizations?.length ?? 0);

for (const phase of ["wave1_shard_", "wave2_profiles_shard_", "wave3_jobs_shard_"]) {
  const files = fs.readdirSync(importsDir).filter((f) => f.startsWith(phase) && f.endsWith(".json"));
  console.log(`\n${phase}* : ${files.length} file(s)`);
  for (const f of files.sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(importsDir, f), "utf8"));
    const n = Array.isArray(j)
      ? j.length
      : j.organizations?.length ?? Object.keys(j.byOrgId || j).filter((k) => k !== "meta").length;
    console.log(`  ${f} → ${n} entries`);
  }
}
