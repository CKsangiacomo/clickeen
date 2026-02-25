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
- Marks iframe host intent as `surface=devstudio` (pairs with `surface=roma` in Roma Builder for explicit host behavior).
- Loads instances via Bob’s `/api/paris/*` proxy (DevStudio never calls Paris directly).
- Local-only unauth convenience is isolated here: DevStudio Local carries explicit `devstudio` surface markers so Bob can mint local sessions only for this toolchain, and only when `ENV_STAGE=local`. Roma/product routes do not get this bypass.
- In **DevStudio Local only**, shows local-only actions (update defaults, reset instance from JSON, create curated instance, update curated, refresh Prague preview, translate locales).
- Uses a 2-step selector in Widget Workspace: pick `Widget` first, then pick an instance from that widget’s scoped list.
- Instance list fetch uses `GET /api/curated-instances?includeConfig=0` and lazy-loads each instance config on selection.

Source: `admin/src/html/tools/dev-widget-workspace.html`.

### Entitlements matrix (AI / LLM access)

DevStudio has two separate gates for Copilot behavior:
- **Profile/model gate** (AI / LLM Access): which providers/models are allowed by tier/profile.
- **Agent runtime gate** (per-agent execution): which agent IDs can execute for each tier/profile.

Important behavior:
- Unlimited budget values alone do not enable CS Copilot.
- For paid profiles (`tier1|tier2|tier3`), both gates must allow a CS-capable provider/model and runtime access for `cs.widget.copilot.v1`.
- Free + Minibob remain constrained to `sdr.widget.copilot.v1` by design.

### Curated instances (single source of truth)

DevStudio Local supports curated instances as the single primitive:
- **Update default config**: pushes current editor state into `tokyo/widgets/{widget}/spec.json` and upserts `wgt_main_{widget}`.
- **Reset instance from JSON**: pulls from compiled defaults (`spec.json`) and overwrites `wgt_main_{widget}`.
- **Create curated instance**: creates `wgt_curated_{widget}_{styleSlug}` from the current editor config, storing metadata (`styleName`, `styleSlug`, and optional `variants`).
- **Update curated instance**: overwrites the selected `wgt_curated_*` config in place with the current editor state.
- **Refresh Prague preview**: calls Paris `POST /api/workspaces/:workspaceId/instances/:publicId/render-snapshot?subject=workspace` to regenerate curated snapshot artifacts (default locale `en`) for Venice/Prague.
- **Translate locales**: calls Paris `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected?subject=workspace` to enqueue locale jobs for the workspace active locale set.

Notes:
- Asset controls upload immediately at edit-time; DevStudio write actions now assume config already contains canonical immutable `/assets/v/**` URLs (no pre-save blob/data persistence pass).
- Curated IDs are locale-free; do not create `wgt_curated_*.<locale>` variants. Locale is a runtime query param.
- Curated metadata lives in `curated_widget_instances.meta`: `{ styleName, styleSlug, variants? }`.
- DevStudio create flow keeps this intentionally minimal: required instance name + optional `variant`/`sub-variant`.
- DevStudio uploads through the canonical Tokyo account route (`POST /assets/upload`) with explicit `x-account-id` + `x-workspace-id`.
- Curated/main flows use `PLATFORM_ACCOUNT_ID`; resulting URLs are canonical immutable version paths:
  - original variant key: `assets/versions/{accountId}/{assetId}/{filename}`
  - non-original variant key: `assets/versions/{accountId}/{assetId}/{variant}/{filename}`
  - persisted runtime URL: `/assets/v/{encodeURIComponent(versionKey)}`
- Legacy Tokyo asset paths (`/workspace-assets/**`, `/curated-assets/**`, `/assets/accounts/**`) are invalid for DevStudio flows.
- Curated actions export the current editor state from Bob (not the last published config).

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Check Bob: `http://localhost:3000`
- Check Paris: `http://localhost:3001/api/healthz`
- If Paris is wedged, re-run `bash scripts/dev-up.sh` (it kills stale `wrangler/workerd` processes before starting services).
