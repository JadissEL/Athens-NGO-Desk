/**
 * Fetch GET {API_BASE}/api/ngo-data and write data/ngos/*.json, then optionally run build:data.
 * Usage: node scripts/export_from_api.js [--build]
 * Env: NGO_DESK_API_BASE=https://api.example.com   (no trailing slash)
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { stripOsintFromRegistry } = require("./merge_osint_into_registry");

const repoRoot = path.join(__dirname, "..");

async function main() {
  const base = (process.env.NGO_DESK_API_BASE || "").replace(/\/$/, "");
  if (!base) {
    console.error("Set NGO_DESK_API_BASE to the API origin (e.g. https://api.example.com)");
    process.exit(1);
  }
  const url = `${base}/api/ngo-data`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  const outDir = path.join(repoRoot, "data", "ngos");
  const map = {
    registry: "athens_greece.json",
    possibility: "job_possibility.json",
    summary: "job_openings_summary.json",
    emails: "spontaneous_emails.json",
    media: "media_week.json",
  };
  for (const [k, file] of Object.entries(map)) {
    if (!(k in data)) {
      console.error(`Missing key in response: ${k}`);
      process.exit(1);
    }
    let payload = data[k];
    if (k === "registry") {
      payload = stripOsintFromRegistry(payload);
    }
    fs.writeFileSync(
      path.join(outDir, file),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
    console.log(`Wrote data/ngos/${file}`);
  }
  const doBuild = process.argv.includes("--build");
  if (doBuild) {
    const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "build_data.js")], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
