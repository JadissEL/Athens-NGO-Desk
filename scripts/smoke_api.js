/**
 * Smoke test: GET /api/health, /api/ready, /api/steward-config, /api/ngo-data
 * Env: NGO_DESK_API_BASE=https://host:port
 */
const base = (process.env.NGO_DESK_API_BASE || "").replace(/\/$/, "");
if (!base) {
  console.error("Set NGO_DESK_API_BASE");
  process.exit(1);
}

async function get(path) {
  const r = await fetch(`${base}${path}`);
  const text = await r.text();
  return { ok: r.ok, status: r.status, text: text.slice(0, 500) };
}

async function main() {
  for (const p of ["/api/health", "/api/ready", "/api/steward-config", "/api/ngo-data"]) {
    const res = await get(p);
    console.log(`${p} -> ${res.status}${res.ok ? " OK" : " FAIL"}`);
    if (!res.ok) {
      console.error(res.text);
      process.exit(1);
    }
  }
  console.log("smoke: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
