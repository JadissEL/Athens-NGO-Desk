/**
 * Merge steward-provided partial NGO rows into data/ngos/athens_greece.json with full schema parity,
 * and append matching stubs to data/ngos/job_possibility.json.
 *
 * Usage (from repo root):
 *   node scripts/import_registry_rows.js path/to/import.json
 *   node scripts/import_registry_rows.js --dry-run path/to/import.json
 *   npm run import:registry -- data/ngos/imports/pending_national.example.json
 *   npm run import:registry -- --dry-run data/ngos/imports/your_batch.json
 *
 * Import file: JSON array of partial objects, or `{ "organizations": [ ... ] }`. Required per row: name. Optional: nameEl, sector, scope, focus, website, notes.
 */
const fs = require("fs");
const path = require("path");
const { validateNgoDataBundle } = require("./validate_data_schemas");
const { normName, normHost } = require("./registry_dedupe_utils");

const repoRoot = path.join(__dirname, "..");
const registryPath = path.join(repoRoot, "data", "ngos", "athens_greece.json");
const possibilityPath = path.join(repoRoot, "data", "ngos", "job_possibility.json");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-n");
  const posArgs = args.filter((a) => !a.startsWith("-"));
  return { dryRun, importFile: posArgs[0] };
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function trimStr(v) {
  if (v == null) return null;
  if (typeof v !== "string") return String(v).trim() || null;
  const t = v.trim();
  return t.length ? t : null;
}

function normalizeWebsite(v) {
  const t = trimStr(v);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9.-]+\.[a-z]{2,}($|\/)/i.test(t) || t.includes(".")) {
    try {
      return new URL("https://" + t.replace(/^\/\//, "")).href;
    } catch {
      return t.startsWith("http") ? t : `https://${t}`;
    }
  }
  return t;
}

/**
 * @param {string[]} ids
 * @returns {number}
 */
function maxNumericId(ids) {
  let m = 0;
  const re = /^ngo-(\d+)-/;
  for (const id of ids) {
    const x = re.exec(id || "");
    if (x) m = Math.max(m, parseInt(x[1], 10));
  }
  return m;
}

/** IDs use zero-padding to 3 digits for n ≤ 999 (legacy); from 1000 onward unpadded decimals (no collision with padded form). */
function formatIdNum(n) {
  if (n <= 999) return String(n).padStart(3, "0");
  return String(n);
}

function defaultJobOpenings() {
  return {
    researchedAt: null,
    totalFound: null,
    sources: [],
    postings: [],
    status: "pending",
  };
}

function defaultJobPossibility() {
  return {
    status: "unscored",
    score: null,
    band: null,
  };
}

function buildOrgRecord(partial, id) {
  const name = trimStr(partial.name);
  if (!name) throw new Error("Each import row must have a non-empty name");

  return {
    id,
    name,
    nameEl: partial.nameEl !== undefined ? trimStr(partial.nameEl) : null,
    sector: trimStr(partial.sector) || "Unknown / to categorise",
    scope: trimStr(partial.scope) || "Greece (steward: refine region)",
    focus: trimStr(partial.focus) || "— (steward: add programme focus)",
    website: normalizeWebsite(partial.website),
    notes: partial.notes !== undefined ? trimStr(partial.notes) : null,
    jobOpenings: defaultJobOpenings(),
    jobPossibility: defaultJobPossibility(),
  };
}

function loadJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch (e) {
    fail(`Invalid JSON: ${fp} — ${e.message}`);
  }
}

/**
 * @param {unknown[]} rawImport
 * @param {Record<string, unknown>} registry
 * @param {Record<string, unknown>} possibility
 * @param {string} importAbs
 * @param {{ dryRun: boolean }} opts
 * @returns {{ added: { id: string, name: string }[], skipped: unknown[] }}
 */
function mergeImportBatch(rawImport, registry, possibility, importAbs, opts) {
  const existing = registry.organizations;
  if (!Array.isArray(existing)) {
    throw new Error('registry.organizations must be an array');
  }
  const existingIds = new Set(existing.map((o) => o.id).filter(Boolean));

  /** @type {Map<string, string>} host -> first id */
  const hostToId = new Map();
  /** @type {Map<string, string>} norm name -> first id */
  const nameToId = new Map();
  for (const o of existing) {
    const h = normHost(o.website);
    if (h && !hostToId.has(h)) hostToId.set(h, o.id);
    const n = normName(o.name);
    if (n.length >= 3 && !nameToId.has(n)) nameToId.set(n, o.id);
  }

  let nextNum = maxNumericId([...existingIds]);
  /** @type {{ id: string, name: string }[]} */
  const added = [];
  /** @type {unknown[]} */
  const skipped = [];
  const batchHosts = new Set();
  const batchNames = new Set();

  for (const partial of rawImport) {
    if (!partial || typeof partial !== "object") {
      skipped.push({ reason: "not_an_object" });
      continue;
    }
    const nameTry = trimStr(partial.name);
    if (!nameTry) {
      skipped.push({ reason: "missing_name", partial });
      continue;
    }

    const website = normalizeWebsite(partial.website);
    const h = normHost(website);
    const nKey = normName(nameTry);

    if (h) {
      if (hostToId.has(h)) {
        skipped.push({ reason: "duplicate_host", host: h, existingId: hostToId.get(h), name: nameTry });
        continue;
      }
      if (batchHosts.has(h)) {
        skipped.push({ reason: "duplicate_host_in_import_batch", host: h, name: nameTry });
        continue;
      }
    }

    if (nKey.length >= 3) {
      if (nameToId.has(nKey)) {
        skipped.push({ reason: "duplicate_name", nameNorm: nKey, existingId: nameToId.get(nKey), name: nameTry });
        continue;
      }
      if (batchNames.has(nKey)) {
        skipped.push({ reason: "duplicate_name_in_import_batch", name: nameTry });
        continue;
      }
    }

    nextNum += 1;
    const idNum = nextNum;
    let baseSlug = slug(nameTry);
    if (!baseSlug) baseSlug = "org";
    /** @type {string} */
    let id = `ngo-${formatIdNum(idNum)}-${baseSlug}`;
    let suffix = 0;
    while (existingIds.has(id)) {
      suffix += 1;
      id = `ngo-${formatIdNum(idNum)}-${baseSlug}-${suffix}`;
    }
    nextNum = idNum;

    let org;
    try {
      org = buildOrgRecord(partial, id);
    } catch (e) {
      skipped.push({ reason: "build_error", message: String(e && e.message) });
      continue;
    }
    existing.push(org);
    existingIds.add(id);

    if (h) {
      hostToId.set(h, id);
      batchHosts.add(h);
    }
    if (nKey.length >= 3) {
      nameToId.set(nKey, id);
      batchNames.add(nKey);
    }

    const possOrgs = possibility.organizations;
    if (!Array.isArray(possOrgs)) {
      throw new Error('possibility.organizations must be an array');
    }
    possOrgs.push({
      id: org.id,
      name: org.name,
      possibility: "Unmeasured",
      score: null,
    });

    added.push({ id: org.id, name: org.name });
  }

  registry.meta = registry.meta && typeof registry.meta === "object" ? registry.meta : {};
  registry.meta.count = existing.length;
  if (added.length > 0 && !opts.dryRun) {
    const now = new Date().toISOString();
    const relImport = path.relative(repoRoot, importAbs).replace(/\\/g, "/");
    const prevNote = registry.meta.note != null ? String(registry.meta.note) : "";
    registry.meta.note = [prevNote, `import_registry_rows ${now}: +${added.length} from ${relImport}`]
      .filter(Boolean)
      .join(" | ");
  }

  const unscored = existing.filter((o) => o.jobPossibility && o.jobPossibility.status === "unscored").length;
  possibility.unresearchedNote = {
    count: unscored,
    message: `${unscored} registry NGOs have no job-possibility score yet (unscored in registry or import stubs).`,
  };

  return { added, skipped };
}

function main() {
  const { dryRun, importFile } = parseArgs(process.argv);
  if (!importFile) {
    fail(
      "Usage: node scripts/import_registry_rows.js [--dry-run|-n] <import.json>\nExample: npm run import:registry -- data/ngos/imports/pending_national.example.json\nDry run: npm run import:registry -- --dry-run data/ngos/imports/your_batch.json"
    );
  }
  const importAbs = path.isAbsolute(importFile) ? importFile : path.join(process.cwd(), importFile);
  if (!fs.existsSync(importAbs)) fail(`Import file not found: ${importAbs}`);

  const rawLoaded = loadJson(importAbs);
  const rawImport = Array.isArray(rawLoaded)
    ? rawLoaded
    : rawLoaded &&
        typeof rawLoaded === "object" &&
        Array.isArray(rawLoaded.organizations)
      ? rawLoaded.organizations
      : null;
  if (!rawImport) {
    fail(
      'Import file must be either a JSON array of partial organisation objects, or an object with an "organizations" array'
    );
  }

  const registry = dryRun ? JSON.parse(JSON.stringify(loadJson(registryPath))) : loadJson(registryPath);
  const possibility = dryRun ? JSON.parse(JSON.stringify(loadJson(possibilityPath))) : loadJson(possibilityPath);

  if (!registry.organizations || !Array.isArray(registry.organizations)) {
    fail(`Invalid registry: ${registryPath}`);
  }
  if (!possibility.organizations || !Array.isArray(possibility.organizations)) {
    fail(`Invalid job_possibility.json: ${possibilityPath}`);
  }

  const { added, skipped } = mergeImportBatch(rawImport, registry, possibility, importAbs, { dryRun });

  const bundle = {
    registry,
    possibility,
    summary: loadJson(path.join(repoRoot, "data", "ngos", "job_openings_summary.json")),
    emails: loadJson(path.join(repoRoot, "data", "ngos", "spontaneous_emails.json")),
    media: loadJson(path.join(repoRoot, "data", "ngos", "media_week.json")),
  };
  const check = validateNgoDataBundle(bundle);
  if (!check.ok) {
    console.error(
      (dryRun ? "Dry-run validation failed:\n" : "Validation failed after merge — revert files and fix import:\n") +
        check.message
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("Dry run — no files written. Would add:");
    for (const a of added) console.log(`  + ${a.id}  ${a.name}`);
    console.log(`Skipped ${skipped.length} row(s).`);
    if (skipped.length) {
      for (const s of skipped) console.log(" ", JSON.stringify(s));
    }
    console.log("validate: merged state would pass full NGO_DATA Ajv check");
    return;
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  fs.writeFileSync(possibilityPath, JSON.stringify(possibility, null, 2));

  console.log(`Added ${added.length} organisation(s). Skipped ${skipped.length} row(s).`);
  if (added.length) {
    for (const a of added) console.log(`  + ${a.id}  ${a.name}`);
  }
  if (skipped.length) {
    console.log("Skipped:");
    for (const s of skipped) console.log(" ", JSON.stringify(s));
  }
  console.log(`Updated ${path.relative(repoRoot, registryPath)} and ${path.relative(repoRoot, possibilityPath)}`);
  console.log("Next: npm run audit:registry-duplicates && npm run build:data");
}

main();
