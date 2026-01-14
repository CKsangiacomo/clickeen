# DevStudio — Internal Tools (Admin)

DevStudio is Clickeen’s internal admin surface for docs + tools. In this repo it lives in `admin/` (Vite).

## Environments

- **DevStudio Local** (`http://localhost:5173`)
  - Superadmin environment for development.
  - Allowed to create/update instance rows (internal-only workflows).
- **DevStudio Cloudflare** (`https://devstudio.dev.clickeen.com`)
  - Fast “did the deploy work?” verification surface.
  - Treated as **read-only** (no DB writes).

## Widget Workspace tool

Route: `/#/dieter/dev-widget-workspace`

What it does:
- Embeds Bob in an iframe (default or via `?bob=http://localhost:3000`).
- Loads instances via Bob’s `/api/paris/*` proxy (DevStudio never calls Paris directly).
- In **DevStudio Local only**, shows superadmin actions (update defaults, create curated instance, create **website creative**).
- Optional: **auto-promote** the resulting instance config to **cloud-dev Paris** (so `prague-dev` sees the change).

Source: `admin/src/html/tools/dev-widget-workspace.html`.

### Auto-promote to cloud-dev (portable-only)

DevStudio Local can optionally promote instance changes to cloud-dev after a superadmin action completes.

Rules (executed):
- Opt-in only (default OFF); enabling requires explicit confirmation.
- Promotion refuses if config contains any `data:` / `blob:` URLs.
- Local Tokyo asset URLs (`http://localhost:4000/workspace-assets/*` and `http://localhost:4000/widgets/*`) can be promoted by uploading bytes to cloud Tokyo and rewriting URLs (requires local-only secrets; never in browser).
- Promotion upserts the instance row directly into cloud Paris (create-or-update), rather than calling the local-only website-creative ensure endpoint.
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

### Website creatives (Prague CMS visuals)

DevStudio Local includes a superadmin action: **Create/update website creative**.

- **Dropdown options source (canonical)**: widget page specs in Tokyo (checked-in JSON)
  - `tokyo/widgets/{widgetType}/pages/{overview|templates|examples|features|pricing}.json`
  - DevStudio loads the selected `{page}.json` and lists only blocks where `visual: true`
  - Slot key is `block.id` (can contain dots; e.g. `feature.left.50`)
- **Deterministic identity**:
  - `creativeKey = {widgetType}.{page}.{block.id}` (locale-free)
  - `publicId = wgt_curated_{creativeKey}` (locale-free; locale is a runtime parameter)
- **How DevStudio executes it**
  - DevStudio requests widget types via Bob’s Paris proxy:
    - `GET /api/paris/widgets`
  - DevStudio ensures the website creative via Bob’s Paris proxy (workspace-owned):
    - `POST /api/paris/website-creative?workspaceId=<workspaceId>`
    - Body includes: `{ widgetType, page, slot, baselineConfig, overwrite? }`
  - Baseline config is seeded from compiled defaults:
    - `GET /api/widgets/{widgetType}/compiled` (Bob compile endpoint)

Notes:
- If the currently selected instance is already a website creative (`publicId` starts with `wgt_curated_`), clicking the button saves the current Bob editor state back into that same instance (no new instance).
- Before any DevStudio save that would write to Paris, DevStudio persists any `data:`/`blob:` URLs found in config by uploading the binary to Tokyo and replacing values with stable `http(s)://` URLs.

Localization note:
- Website creative IDs are locale-free; do not create `wgt_curated_*.<locale>` variants.
- To localize a website creative, add a Tokyo `l10n` overlay at `l10n/instances/<publicId>/<locale>.ops.json` and run `pnpm build:l10n` (Venice applies overlays at runtime).

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Check Bob: `http://localhost:3000`
- Check Paris: `http://localhost:3001/api/healthz`
- If Paris is wedged, re-run `bash scripts/dev-up.sh` (it kills stale `wrangler/workerd` processes before starting services).
