# Google Stitch + MCP (OAuth)

Use **Stitch** ([Google Labs](https://stitch.withgoogle.com/)) to iterate on **Greece NGO Desk** UI (home, registry, openings, org profiles), then implement winners in `static-site/`.

**Active Stitch project:** [Greece NGO Desk](https://stitch.withgoogle.com/) — id `14677559256789528548` · design system **Aegean Civic Craft** (`assets/d42af7c3d09e40089c1623f92d77b011`). MCP generation calls often **time out** in Cursor; screens may still finish — refresh the project in Stitch after ~2–5 minutes.

If Cursor shows **Incompatible auth server** for Stitch MCP, run `gcloud auth application-default login` and reload MCP (see below). Until MCP works, paste prompts from **[STITCH_SCREEN_PROMPTS.md](STITCH_SCREEN_PROMPTS.md)** in the Stitch UI and ship CSS via **`static-site/stitch-polish.css`**.

**Canonical setup:** [Stitch MCP setup](https://stitch.withgoogle.com/docs/mcp/setup/) (OAuth section).

## Prerequisites

1. **Google Cloud SDK** (`gcloud`) on your PC.
2. A **Google Cloud project** with billing/API access as required by Stitch.
3. **Stitch API** enabled on that project.

## One-time OAuth (browser)

```powershell
gcloud auth login
gcloud auth application-default login
```

Pick the Google account that has access to Stitch / your GCP project.

```powershell
$env:GOOGLE_CLOUD_PROJECT = "your-gcp-project-id"
gcloud config set project $env:GOOGLE_CLOUD_PROJECT
gcloud beta services mcp enable stitch.googleapis.com --project="$env:GOOGLE_CLOUD_PROJECT"

$email = gcloud config get-value account
gcloud projects add-iam-policy-binding $env:GOOGLE_CLOUD_PROJECT `
  --member="user:$email" `
  --role="roles/serviceusage.serviceUsageConsumer" `
  --condition=None
```

Persist the project id (not a secret) in **`%USERPROFILE%\.cursor\mcp.secrets.env`**:

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

## Cursor MCP (this machine)

User-level MCP uses **`%USERPROFILE%\.cursor\scripts\stitch-mcp-bridge.ps1`**, which:

- Reads `GOOGLE_CLOUD_PROJECT` from env / `mcp.secrets.env`
- Calls `gcloud auth application-default print-access-token` on each session
- Proxies to `https://stitch.googleapis.com/mcp` via `mcp-remote`

After editing `%USERPROFILE%\.cursor\mcp.json`, **reload MCP** in Cursor (or restart).

## Workflow with the agent

1. `list_projects` / `create_project` — e.g. **Greece NGO Desk**.
2. `create_design_system` — warm Aegean tokens aligned with product positioning.
3. `generate_screen_from_text` — Home, Openings table, Registry, Org profile (desktop ≥1440px).
4. `generate_variants` / `edit_screens` — less “dry” hero, clearer nav IA.
5. Agent maps approved screens → `static-site/styles.css` + `index.html` / `app.js`.

## Token lifetime

Access tokens are **short-lived**. The bridge refreshes them when Cursor starts the Stitch MCP server. If MCP fails with **Unauthenticated**, run `gcloud auth application-default login` again.

## API key alternative

If OAuth is painful, use a **Stitch API key** in MCP headers (`X-Goog-Api-Key`) — see Stitch settings. OAuth is preferred when you do not want a long-lived key on disk.
