/**
 * JSON Schema validation (draft 2020-12) for data/ngos/*.json via Ajv.
 * Used by build_data.js and `npm run validate:schemas`.
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const { mergeOsintIntoRegistry } = require("./merge_osint_into_registry");

const repoRoot = path.join(__dirname, "..");

/**
 * Fastify on Render uses `rootDir: server` — dependencies live in `server/node_modules`, but this
 * file lives under `scripts/` at the repo root. Default `require()` resolution starts from `scripts/`
 * and never reaches `server/node_modules`, so we anchor resolution to `server/package.json` when present.
 */
function requireAjvFromServerOrRoot() {
  const serverPkg = path.join(repoRoot, "server", "package.json");
  const rootPkg = path.join(repoRoot, "package.json");
  try {
    const req = createRequire(serverPkg);
    return {
      Ajv2020: req("ajv/dist/2020"),
      addFormats: req("ajv-formats"),
    };
  } catch {
    const req = createRequire(rootPkg);
    return {
      Ajv2020: req("ajv/dist/2020"),
      addFormats: req("ajv-formats"),
    };
  }
}

const { Ajv2020, addFormats } = requireAjvFromServerOrRoot();
const schemasDir = path.join(repoRoot, "schemas");

const bundleMap = [
  { key: "registry", file: "athens_greece.json", schema: "athens_greece.schema.json" },
  { key: "possibility", file: "job_possibility.json", schema: "job_possibility.schema.json" },
  { key: "summary", file: "job_openings_summary.json", schema: "job_openings_summary.schema.json" },
  { key: "emails", file: "spontaneous_emails.json", schema: "spontaneous_emails.schema.json" },
  { key: "media", file: "media_week.json", schema: "media_week.schema.json" },
];

const optionalFiles = [
  { file: "osint_profiles.json", schema: "osint_profiles.schema.json" },
];

function makeValidator() {
  const ajv = new Ajv2020.default({
    allErrors: true,
    strict: true,
    validateSchema: true,
  });
  addFormats(ajv);

  const validators = {};
  for (const row of bundleMap) {
    const schemaPath = path.join(schemasDir, row.schema);
    const raw = fs.readFileSync(schemaPath, "utf8");
    const schema = JSON.parse(raw);
    validators[row.key] = ajv.compile(schema);
  }
  for (const row of optionalFiles) {
    const schemaPath = path.join(schemasDir, row.schema);
    const raw = fs.readFileSync(schemaPath, "utf8");
    const schema = JSON.parse(raw);
    validators[`optional:${row.file}`] = ajv.compile(schema);
  }
  return validators;
}

function formatAjvErrors(errors) {
  return (errors || [])
    .map((e) => `${e.instancePath || "/"} ${e.message}`.trim())
    .join("\n");
}

/**
 * @param {Record<string, unknown>} data - same shape as window.NGO_DATA (registry, possibility, ...)
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateNgoDataBundle(data) {
  const validators = makeValidator();
  const errors = [];

  /** @type {Record<string, unknown>} */
  const dataForSchema = { ...data };
  if (dataForSchema.registry && typeof dataForSchema.registry === "object") {
    dataForSchema.registry = mergeOsintIntoRegistry(
      /** @type {Record<string, unknown>} */ (dataForSchema.registry),
      repoRoot,
      {
        possibility: dataForSchema.possibility,
        media: dataForSchema.media,
        emails: dataForSchema.emails,
        summary: dataForSchema.summary,
      }
    );
  }

  for (const row of bundleMap) {
    const validate = validators[row.key];
    const payload = dataForSchema[row.key];
    if (!validate(payload)) {
      const detail = formatAjvErrors(validate.errors);
      errors.push(`${row.schema} (${row.key}):\n${detail}`);
    }
  }

  const dataDir = path.join(repoRoot, "data", "ngos");
  for (const row of optionalFiles) {
    const fp = path.join(dataDir, row.file);
    if (!fs.existsSync(fp)) continue;
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch (e) {
      errors.push(`${row.file}: invalid JSON — ${e.message}`);
      continue;
    }
    const validate = validators[`optional:${row.file}`];
    if (!validate(payload)) {
      const detail = formatAjvErrors(validate.errors);
      errors.push(`${row.schema} (${row.file}):\n${detail}`);
    }
  }

  if (errors.length) {
    return { ok: false, message: errors.join("\n\n") };
  }
  return { ok: true };
}

module.exports = { validateNgoDataBundle, bundleMap, repoRoot };

if (require.main === module) {
  const dataDir = path.join(repoRoot, "data", "ngos");
  const data = {};
  for (const row of bundleMap) {
    const fp = path.join(dataDir, row.file);
    if (!fs.existsSync(fp)) {
      console.error(`Missing: ${fp}`);
      process.exit(1);
    }
    try {
      data[row.key] = JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch (e) {
      console.error(`Invalid JSON: ${fp}`, e.message);
      process.exit(1);
    }
  }
  for (const row of optionalFiles) {
    const fp = path.join(dataDir, row.file);
    if (!fs.existsSync(fp)) continue;
    try {
      JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch (e) {
      console.error(`Invalid JSON: ${fp}`, e.message);
      process.exit(1);
    }
  }
  const result = validateNgoDataBundle(data);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log("validate: JSON Schema OK (Ajv)");
}
