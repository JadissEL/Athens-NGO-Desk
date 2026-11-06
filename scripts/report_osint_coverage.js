/**
 * OSINT profile coverage report (desk-held merged profiles).
 * Run: npm run osint:coverage
 *
 * Writes data/ngos/osint_coverage_report.json and prints a short summary.
 */
const fs = require("fs");
const path = require("path");
const { mergeOsintIntoRegistry } = require("./merge_osint_into_registry");

const repoRoot = path.join(__dirname, "..");
const dataDir = path.join(repoRoot, "data", "ngos");
const outFile = path.join(dataDir, "osint_coverage_report.json");

function loadJson(name) {
  const fp = path.join(dataDir, name);
  if (!fs.existsSync(fp)) throw new Error(`Missing ${fp}`);
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function tierFor(orgProfile) {
  const refs = orgProfile.references || [];
  const media = orgProfile.deskCorpus?.mediaDigestMatches || [];
  const nRefs = refs.length;
  const nMedia = media.length;
  if (nRefs >= 5 || (nRefs >= 2 && nMedia >= 1)) return "strong";
  if (nRefs >= 1 || nMedia >= 1) return "moderate";
  return "thin";
}

/**
 * @param {unknown} poss
 * @param {string} orgId
 */
function possibilityRowByOrgId(poss, orgId) {
  if (!poss || typeof poss !== "object") return null;
  const orgs = /** @type {Record<string, unknown>} */ (poss).organizations;
  if (!Array.isArray(orgs)) return null;
  const row = orgs.find((o) => o && typeof o === "object" && (/** @type {Record<string, unknown>} */ (o)).id === orgId);
  return row && typeof row === "object" ? /** @type {Record<string, unknown>} */ (row) : null;
}

/**
 * @param {unknown} summaryBundle
 * @param {string} orgId
 */
function summaryHasCareersUrl(summaryBundle, orgId) {
  if (!summaryBundle || typeof summaryBundle !== "object") return false;
  const researched = /** @type {Record<string, unknown>} */ (summaryBundle).researched;
  if (!Array.isArray(researched)) return false;
  const row = researched.find((r) => r && typeof r === "object" && (/** @type {Record<string, unknown>} */ (r)).id === orgId);
  return !!(row && typeof (/** @type {Record<string, unknown>} */ (row)).careersUrl === "string");
}

/**
 * @param {Record<string, unknown>} orgRow - registry organisation
 * @param {Record<string, unknown>} profile - merged osintProfile
 * @param {unknown} possibility
 * @param {unknown} summaryBundle
 * @returns {string[]}
 */
function stewardHintsForThin(orgRow, profile, possibility, summaryBundle) {
  /** @type {string[]} */
  const h = [];
  const orgId = typeof orgRow.id === "string" ? orgRow.id : "";
  const jo = orgRow.jobOpenings && typeof orgRow.jobOpenings === "object" ? orgRow.jobOpenings : {};
  const refs = Array.isArray(profile.references) ? profile.references : [];
  const media = profile.deskCorpus?.mediaDigestMatches;
  const nMedia = Array.isArray(media) ? media.length : 0;
  const possRow = orgId ? possibilityRowByOrgId(possibility, orgId) : null;

  if (!orgRow.website) h.push("Add public website URL in registry when verified.");
  const hasCareers = !!(jo.careersUrl && typeof jo.careersUrl === "string");
  const researchedCareers = summaryHasCareersUrl(summaryBundle, orgId);
  if (!hasCareers && !researchedCareers && jo.status !== "researched") {
    h.push("Research careers page or mark jobOpenings.status researched with sources.");
  }
  if (jo.status === "pending" && (!Array.isArray(jo.postings) || jo.postings.length === 0)) {
    h.push("job_research_seed / merge:jobs — index at least one posting or document pending.");
  }
  if (!possRow || possRow.score == null) {
    h.push("job_possibility.json — add scored row for narrative + staff/beneficiary signals.");
  }
  if (nMedia === 0) {
    h.push("media_week.json — tag org in digest or extend ORG_ALIAS_TOKENS.");
  }
  if (refs.length === 0) {
    h.push("osint_profiles.json — curated references[] after primary-source check.");
  }
  const contacts = profile.onlinePresence?.contactHints;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    h.push("spontaneous_emails.json — add orgId row (email and/or applyUrl).");
  }
  return h;
}

function main() {
  const registry = loadJson("athens_greece.json");
  const possibility = loadJson("job_possibility.json");
  const media = loadJson("media_week.json");
  const emails = loadJson("spontaneous_emails.json");
  /** @type {Record<string, unknown>} */
  const summary = loadJson("job_openings_summary.json");

  const merged = mergeOsintIntoRegistry(registry, repoRoot, {
    buildTimeIso: new Date().toISOString(),
    possibility,
    media,
    emails,
    summary,
  });

  const orgs = merged.organizations || [];
  /** @type {unknown[]} */
  const rows = [];
  /** @type {Record<string, number>} */
  const hintCounts = {};
  let strong = 0;
  let moderate = 0;
  let thin = 0;

  for (const org of orgs) {
    if (!org || typeof org !== "object") continue;
    const o = /** @type {Record<string, unknown>} */ (org);
    const p = o.osintProfile;
    if (!p || typeof p !== "object") continue;
    const profile = /** @type {Record<string, unknown>} */ (p);
    const refs = Array.isArray(profile.references) ? profile.references : [];
    const mediaM = profile.deskCorpus?.mediaDigestMatches;
    const nMedia = Array.isArray(mediaM) ? mediaM.length : 0;
    const t = tierFor(profile);
    if (t === "strong") strong++;
    else if (t === "moderate") moderate++;
    else thin++;

    const hints = t === "thin" ? stewardHintsForThin(o, profile, possibility, summary) : [];
    for (const line of hints) {
      hintCounts[line] = (hintCounts[line] || 0) + 1;
    }

    rows.push({
      id: o.id,
      name: o.name,
      tier: t,
      referenceCount: refs.length,
      mediaDigestMatchCount: nMedia,
      confidence: profile.verification?.confidence ?? null,
      stewardHints: hints.length ? hints : undefined,
    });
  }

  const thinIds = rows.filter((r) => r.tier === "thin").map((r) => r.id);
  const thinStewardHintsTop = Object.entries(hintCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([hint, orgCount]) => ({ hint, orgCount }));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      strong,
      moderate,
      thin,
      thinNeedingManualOsint: thinIds.length,
      thinStewardHintsTop,
    },
    tiers: {
      strong: "≥5 references OR (≥2 references and ≥1 media digest match)",
      moderate: "≥1 reference OR ≥1 digest match",
      thin: "no references and no digest matches (strengthen via osint_profiles.json or more desk data)",
    },
    organizations: rows.sort((a, b) => a.name.localeCompare(b.name)),
    thinOrgIds: thinIds.sort(),
  };

  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("OSINT coverage report");
  console.log(`  Total orgs: ${report.summary.total}`);
  console.log(`  Strong: ${strong} · Moderate: ${moderate} · Thin: ${thin}`);
  if (thinStewardHintsTop.length) {
    console.log("  Top steward hints (thin orgs):");
    for (const { hint, orgCount } of thinStewardHintsTop) {
      console.log(`    · (${orgCount}) ${hint}`);
    }
  }
  console.log(`  Wrote ${path.relative(repoRoot, outFile)}`);
}

main();
