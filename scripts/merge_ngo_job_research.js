const fs = require("fs");
const path = require("path");
const { validateJobResearchSeed } = require("./validate_job_research_seed.js");

const root = path.join(__dirname, "..", "data", "ngos");
const registryPath = path.join(root, "athens_greece.json");
const seedPath = path.join(root, "job_research_seed.json");
const summaryPath = path.join(root, "job_openings_summary.json");

const seedCheck = validateJobResearchSeed();
if (!seedCheck.ok) {
  console.error("job_research_seed.json schema failed:\n" + seedCheck.message);
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const now = new Date().toISOString();

let researched = 0;
let totalPostings = 0;

for (const org of registry.organizations) {
  const hit = seed.byOrgId[org.id];
  if (!hit) continue;
  org.jobOpenings = {
    researchedAt: seed.meta.researchedAt || now,
    totalFound: hit.totalFound,
    sources: hit.sources || [],
    careersUrl: hit.careersUrl || null,
    postings: hit.postings || [],
    status: hit.status || "researched",
    notes: hit.notes || null,
  };
  researched += 1;
  totalPostings += hit.totalFound || 0;
}

registry.meta.jobResearch = {
  lastMergedAt: now,
  orgsResearched: researched,
  orgsPending: registry.organizations.length - researched,
  postingsIndexed: totalPostings,
  seedFile: "data/ngos/job_research_seed.json",
  caveat:
    "Public careers pages + boards only. Not a complete historical count of every vacancy ever published by each NGO.",
};

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

const rows = registry.organizations
  .filter((o) => o.jobOpenings && o.jobOpenings.status !== "pending")
  .map((o) => ({
    id: o.id,
    name: o.name,
    status: o.jobOpenings.status,
    totalFound: o.jobOpenings.totalFound,
    careersUrl: o.jobOpenings.careersUrl,
    dates: (o.jobOpenings.postings || [])
      .map((p) => p.postedDate || p.deadline)
      .filter(Boolean),
  }))
  .sort((a, b) => (b.totalFound || 0) - (a.totalFound || 0));

fs.writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      meta: registry.meta.jobResearch,
      researched: rows,
    },
    null,
    2
  )
);

console.log(
  `Merged ${researched} orgs, ${totalPostings} postings indexed -> ${registryPath}`
);
console.log(`Summary -> ${summaryPath}`);
