Greece NGO Desk — bundle from CVfinalizer repo
Generated: 2026-11-06 16:13

Contents
- static-site/ : Open index.html in a browser (Greece NGO Desk UI)
- data/ngos/ : Registry, jobs, emails, media digest, merge inputs (canonical JSON)
- scripts/ : merge_ngo_job_research.js, import_registry_rows.js, extract_ngos_from_canvas.js, build_data.js
- docs/ : ARCHITECTURE.md, DATA_PIPELINE.md

Rebuild data.js for the static site (from repo root):

  npm run merge:jobs        # optional — applies job research into athens_greece.json
  npm run validate:import -- data/ngos/imports/your_batch.json   # optional — batch shape only
  npm run import:registry -- --dry-run data/ngos/imports/your_batch.json   # optional — preview IDs/skips, no write
  npm run import:registry -- data/ngos/imports/your_batch.json   # optional — append national org rows (full schema)
  npm run audit:registry-duplicates   # optional — duplicate host/name report
  npm run validate        # Ajv check on data/ngos/*.json
  npm run build:data        # writes static-site/data.js from data/ngos/*.json

This Desktop copy is standalone for reference; regenerate data.js locally if you edit JSON here.
