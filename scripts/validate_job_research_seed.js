/**
 * Validate data/ngos/job_research_seed.json against schemas/job_research_seed.schema.json
 */
const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const repoRoot = path.join(__dirname, "..");

function validateJobResearchSeed() {
  const schemaPath = path.join(repoRoot, "schemas", "job_research_seed.schema.json");
  const dataPath = path.join(repoRoot, "data", "ngos", "job_research_seed.json");
  const ajv = new Ajv2020.default({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const validate = ajv.compile(schema);
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!validate(data)) {
    const errs = (validate.errors || [])
      .map((e) => `${e.instancePath || "/"} ${e.message}`)
      .join("\n");
    return { ok: false, message: errs };
  }
  return { ok: true };
}

module.exports = { validateJobResearchSeed };

if (require.main === module) {
  const r = validateJobResearchSeed();
  if (!r.ok) {
    console.error(r.message);
    process.exit(1);
  }
  console.log("validate: job_research_seed.json OK");
}
