/**
 * Audit `data/ngos/athens_greece.json` for likely duplicates (same website host or same normalized name).
 * Run from repo root: `npm run audit:registry-duplicates`
 */
const fs = require("fs");
const path = require("path");
const { normName, normHost } = require("./registry_dedupe_utils");

const registryPath = path.join(__dirname, "..", "data", "ngos", "athens_greece.json");

function main() {
  const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const orgs = raw.organizations || [];

  const byHost = new Map();
  const byName = new Map();

  for (const o of orgs) {
    const h = normHost(o.website);
    if (h) {
      if (!byHost.has(h)) byHost.set(h, []);
      byHost.get(h).push({ id: o.id, name: o.name });
    }
    const n = normName(o.name);
    if (n.length >= 3) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push({ id: o.id, name: o.name, website: o.website });
    }
  }

  const dupHosts = [...byHost.entries()].filter(([, list]) => list.length > 1);
  const dupNames = [...byName.entries()].filter(([, list]) => list.length > 1);

  const report = {
    generatedAt: new Date().toISOString(),
    registryPath: "data/ngos/athens_greece.json",
    organizationCount: orgs.length,
    duplicateWebsiteHosts: dupHosts.map(([host, list]) => ({ host, organizations: list })),
    duplicateNormalizedNames: dupNames.map(([nameNorm, list]) => ({ nameNorm, organizations: list })),
  };

  const outJson = path.join(__dirname, "..", "data", "ngos", "registry_duplicate_report.json");
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

  console.log(`Organizations: ${orgs.length}`);
  console.log(`Duplicate website host groups: ${dupHosts.length}`);
  for (const [host, list] of dupHosts) {
    console.log(`  ${host}: ${list.map((x) => x.id).join(", ")}`);
  }
  console.log(`Duplicate normalized name groups: ${dupNames.length}`);
  for (const [, list] of dupNames) {
    console.log(`  "${list[0].name}": ${list.map((x) => x.id).join(", ")}`);
  }
  console.log(`\nWrote ${path.relative(process.cwd(), outJson)}`);
}

main();
