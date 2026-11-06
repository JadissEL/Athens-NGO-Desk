/**
 * Bundles canonical JSON under data/ngos/ into static-site/data.js (window.NGO_DATA).
 * Run from repo root: npm run build:data
 */
const fs = require("fs");
const path = require("path");
const { validateNgoDataBundle } = require("./validate_data_schemas");
const { mergeOsintIntoRegistry } = require("./merge_osint_into_registry");

const repoRoot = path.join(__dirname, "..");
const dataDir = path.join(repoRoot, "data", "ngos");
const outFile = path.join(repoRoot, "static-site", "data.js");

const inputs = {
  registry: "athens_greece.json",
  possibility: "job_possibility.json",
  summary: "job_openings_summary.json",
  emails: "spontaneous_emails.json",
  media: "media_week.json",
};

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function isPlainObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Minimal structural checks so typos in JSON do not ship as silent empty UI.
 */
function validateBundle(data) {
  const r = data.registry;
  if (!isPlainObject(r) || !Array.isArray(r.organizations)) {
    fail('validate: registry must be an object with an "organizations" array');
  }

  const poss = data.possibility;
  if (!isPlainObject(poss)) {
    fail('validate: possibility must be an object');
  }
  if (poss.organizations !== undefined && !Array.isArray(poss.organizations)) {
    fail('validate: possibility.organizations must be an array when present');
  }

  const sum = data.summary;
  if (!isPlainObject(sum) || !isPlainObject(sum.meta) || !Array.isArray(sum.researched)) {
    fail('validate: summary must have object "meta" and array "researched"');
  }

  const em = data.emails;
  if (!isPlainObject(em) || !isPlainObject(em.meta) || !Array.isArray(em.contacts)) {
    fail('validate: emails must have object "meta" and array "contacts"');
  }

  const med = data.media;
  if (!isPlainObject(med) || !isPlainObject(med.meta) || !Array.isArray(med.articles)) {
    fail('validate: media must have object "meta" and array "articles"');
  }
}

const data = {};
for (const [key, filename] of Object.entries(inputs)) {
  const fp = path.join(dataDir, filename);
  if (!fs.existsSync(fp)) {
    fail(`Missing required file: ${fp}`);
  }
  try {
    data[key] = JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch (e) {
    fail(`Invalid JSON: ${fp} — ${e.message}`);
  }
}

data.registry = mergeOsintIntoRegistry(data.registry, repoRoot, {
  buildTimeIso: new Date().toISOString(),
  possibility: data.possibility,
  media: data.media,
  emails: data.emails,
  summary: data.summary,
});

validateBundle(data);

const schemaResult = validateNgoDataBundle(data);
if (!schemaResult.ok) {
  fail(`validate: JSON Schema failed:\n${schemaResult.message}`);
}

const payload = `window.NGO_DATA = ${JSON.stringify(data)};\n`;
fs.writeFileSync(outFile, payload, "utf8");
console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
console.log("validate: structural checks OK");
console.log("validate: JSON Schema OK (Ajv)");
