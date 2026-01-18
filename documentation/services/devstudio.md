# DevStudio — Internal Tools (Admin)

DevStudio is Clickeen’s internal admin surface for docs + tools. In this repo it lives in `admin/` (Vite).

## Environments

- **DevStudio Local** (`http://localhost:5173`)
  - Superadmin environment for development.
  - Allowed to create/update instance rows (internal-only workflows).
- **DevStudio Cloudflare** (`https://devstudio.dev.clickeen.com`)
  - Fast “did the deploy work?” verification surface.
  - Treated as **read-only** (no DB writes); DevStudio sets `?readonly=1` on the Bob iframe.

## Widget Workspace tool

Route: `/#/dieter/dev-widget-workspace`

What it does:
- Embeds Bob in an iframe (default or via `?bob=http://localhost:3000`).
- Loads instances via Bob’s `/api/paris/*` proxy (DevStudio never calls Paris directly).
- In **DevStudio Local only**, shows superadmin actions (update defaults, reset from JSON, create curated template).
- Optional: **auto-promote** the resulting instance config to **cloud-dev Paris** (so `prague-dev` sees the change).

Source: `admin/src/html/tools/dev-widget-workspace.html`.

### Auto-promote to cloud-dev (portable-only)

DevStudio Local can optionally promote instance changes to cloud-dev after a superadmin action completes.

Rules (executed):
- Opt-in only (default OFF); enabling requires explicit confirmation.
- Promotion refuses if config contains any `data:` / `blob:` URLs.
- Local Tokyo asset URLs (`http://localhost:4000/workspace-assets/*` and `http://localhost:4000/widgets/*`) can be promoted by uploading bytes to cloud Tokyo and rewriting URLs (requires local-only secrets; never in browser).
- Promotion upserts the instance row directly into cloud Paris (create-or-update).
- Promotion exists to keep `prague-dev` consistent while keeping secrets out of the browser; refusal prevents pushing broken configs that would not load outside your machine.

Implementation:
- UI + client call site: `admin/src/html/tools/dev-widget-workspace.html`
- Local server middleware: `admin/vite.config.ts` (`POST /api/promote-instance`)

Required local env vars (DevStudio Local only):
- `CK_SUPERADMIN_KEY` — no longer used by `POST /api/promote-instance` in DevStudio Local (solo-dev simplification)
- `CK_CLOUD_PARIS_DEV_JWT` (preferred) or `PARIS_DEV_JWT` (fallback) — Bearer token for cloud Paris dev-auth
- `CK_CLOUD_PARIS_BASE_URL` (optional) — defaults to `https://paris.dev.clickeen.com`
- `TOKYO_DEV_JWT` — Bearer token for cloud Tokyo upload (only needed when promoting instances that reference local Tokyo assets)
- `CK_CLOUD_TOKYO_BASE_URL` (optional) — defaults to `https://tokyo.dev.clickeen.com`

### Curated instances (templates + Prague embeds)

DevStudio Local supports curated instances as the single primitive:
- **Update default config**: pushes current editor state into `tokyo/widgets/{widget}/spec.json` and upserts `wgt_main_{widget}`.
- **Reset instance from JSON**: pulls from compiled defaults (`spec.json`) and overwrites `wgt_main_{widget}`.
- **Create template instance**: snapshots the current config into `wgt_curated_{widget}.templates.{key}`.

Notes:
- Before any DevStudio save that would write to Paris, DevStudio persists any `data:`/`blob:` URLs found in config by uploading the binary to Tokyo and replacing values with stable `http(s)://` URLs.
- Curated IDs are locale-free; do not create `wgt_curated_*.<locale>` variants. Locale is a runtime query param.

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Check Bob: `http://localhost:3000`
- Check Paris: `http://localhost:3001/api/healthz`
- If Paris is wedged, re-run `bash scripts/dev-up.sh` (it kills stale `wrangler/workerd` processes before starting services).
