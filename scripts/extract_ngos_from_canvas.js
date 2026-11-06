const fs = require("fs");
const path = require("path");

const defaultCanvas = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-Jadiss-OneDrive-Bureau-CVfinalizer/canvases/athens-greece-ngos.canvas.tsx"
);
const canvas = process.env.NGO_DESK_CANVAS_PATH
  ? path.resolve(process.env.NGO_DESK_CANVAS_PATH)
  : defaultCanvas;

if (!fs.existsSync(canvas)) {
  console.error(`Canvas file not found:\n  ${canvas}`);
  console.error(
    "Set NGO_DESK_CANVAS_PATH to the absolute path of athens-greece-ngos.canvas.tsx, or copy the ORGS array into a file and pass that path."
  );
  process.exit(1);
}
const t = fs.readFileSync(canvas, "utf8");
const m = t.match(/const ORGS: Org\[\] = (\[[\s\S]*?\n\]);/);
if (!m) {
  console.error("ORGS array not found");
  process.exit(1);
}
const ORGS = new Function(`return (${m[1]})`)();
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const registry = {
  meta: {
    title: "NGOs operating in Greece (national scope; Athens as a major hub)",
    createdAt: new Date().toISOString(),
    source: "canvas athens-greece-ngos + Migration Ministry / UNHCR / HelpPoint / NGOBase",
    count: ORGS.length,
    note: "jobOpenings filled by research scripts; not a complete national census",
  },
  organizations: ORGS.map((o, i) => ({
    id: `ngo-${String(i + 1).padStart(3, "0")}-${slug(o.name)}`,
    name: o.name,
    nameEl: o.nameEl || null,
    sector: o.sector,
    scope: o.scope,
    focus: o.focus,
    website: o.website || null,
    notes: o.notes || null,
    jobOpenings: {
      researchedAt: null,
      totalFound: null,
      sources: [],
      postings: [],
      status: "pending",
    },
  })),
};

const outDir = path.join(__dirname, "..", "data", "ngos");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "athens_greece.json");
fs.writeFileSync(out, JSON.stringify(registry, null, 2));
console.log(`Wrote ${registry.organizations.length} orgs -> ${out}`);
