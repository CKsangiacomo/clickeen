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
- In **DevStudio Local only**, shows local-only actions (update defaults, reset instance from JSON, create curated instance, create new version, refresh Prague preview, translate locales).

Source: `admin/src/html/tools/dev-widget-workspace.html`.

### Curated instances (single source of truth)

DevStudio Local supports curated instances as the single primitive:
- **Update default config**: pushes current editor state into `tokyo/widgets/{widget}/spec.json` and upserts `wgt_main_{widget}`.
- **Reset instance from JSON**: pulls from compiled defaults (`spec.json`) and overwrites `wgt_main_{widget}`.
- **Create curated instance**: creates `wgt_curated_{widget}.{styleSlug}.v01` from the current editor config, storing metadata (style name + tags).
- **Create new instance version**: creates the next `vNN` for the same style slug.
- **Update curated instance**: overwrites the selected `wgt_curated_*` config in place with the current editor state.
- **Refresh Prague preview**: calls Paris `POST /api/workspaces/:workspaceId/instances/:publicId/render-snapshot?subject=devstudio` to regenerate curated snapshot artifacts (default locale `en`) for Venice/Prague.
- **Translate locales**: calls Paris `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected?subject=devstudio` to enqueue locale jobs for the workspace active locale set.

Notes:
- Before any DevStudio save that would write to Paris, DevStudio persists any `data:`/`blob:` URLs found in config by uploading the binary to Tokyo and replacing values with stable `http(s)://` URLs.
- Curated IDs are locale-free; do not create `wgt_curated_*.<locale>` variants. Locale is a runtime query param.
- Curated metadata lives in `curated_widget_instances.meta`: `{ styleName, styleSlug, version, tags }`. Tags are system-managed (ICP / objective / style).
- Curated assets (including `wgt_main_*`) are stored under `tokyo/curated-assets/{widgetType}/{publicId}/...` and served from Tokyo CDN.
- Curated actions export the current editor state from Bob (not the last published config).

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Check Bob: `http://localhost:3000`
- Check Paris: `http://localhost:3001/api/healthz`
- If Paris is wedged, re-run `bash scripts/dev-up.sh` (it kills stale `wrangler/workerd` processes before starting services).
