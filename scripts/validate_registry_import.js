/**
 * Validate a steward import JSON file against schemas/registry_import_batch.schema.json
 *
 * Usage: node scripts/validate_registry_import.js path/to/batch.json
 *        npm run validate:import -- data/ngos/imports/pending_national.example.json
 */
const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const repoRoot = path.join(__dirname, "..");

function formatErrors(errors) {
  return (errors || [])
    .map((e) => `${e.instancePath || "/"} ${e.message}`.trim())
    .join("\n");
}

/**
 * @param {string} filePath - absolute or cwd-relative path to import JSON
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateRegistryImportFile(filePath) {
  const schemaPath = path.join(repoRoot, "schemas", "registry_import_batch.schema.json");
  const ajv = new Ajv2020.default({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const validate = ajv.compile(schema);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return { ok: false, message: `Invalid JSON: ${e.message}` };
  }
  if (!validate(raw)) {
    return { ok: false, message: formatErrors(validate.errors) };
  }
  return { ok: true };
}

module.exports = { validateRegistryImportFile };

if (require.main === module) {
  const fp = process.argv[2];
  if (!fp) {
    console.error("Usage: node scripts/validate_registry_import.js <import.json>");
    process.exit(1);
  }
  const abs = path.isAbsolute(fp) ? fp : path.join(process.cwd(), fp);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const r = validateRegistryImportFile(abs);
  if (!r.ok) {
    console.error(`registry_import_batch.schema.json:\n${r.message}`);
    process.exit(1);
  }
  console.log(`validate: import batch OK (${path.relative(process.cwd(), abs)})`);
}
