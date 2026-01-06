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
- In **DevStudio Local only**, shows superadmin actions (update defaults, create template instance, create **website creative**).

Source: `admin/src/html/tools/dev-widget-workspace.html`.

### Website creatives (Prague CMS visuals)

DevStudio Local includes a superadmin action: **Create website creative**.

- **Dropdown options source (registry)**: Prague-owned TS registry
  - `prague/src/lib/websiteCreativeRegistry.ts`
  - v1: `overview` has creative slots `hero` + `features` (others empty until Prague expands the registry).
- **Deterministic identity (v1)**:
  - `creativeKey = {widgetType}.{page}.{slot}` (locale-free)
  - `publicId = wgt_web_{creativeKey}.{locale}` (locale-specific; DevStudio defaults `locale=en`)
- **How DevStudio executes it**
  - DevStudio requests widget types via Bob’s Paris proxy:
    - `GET /api/paris/widgets`
  - DevStudio ensures the website creative via Bob’s Paris proxy (workspace-owned):
    - `POST /api/paris/website-creative?workspaceId=<workspaceId>`
    - Body includes: `{ widgetType, page, slot, locale, baselineConfig }`
  - Baseline config is seeded from compiled defaults:
    - `GET /api/widgets/{widgetType}/compiled` (Bob compile endpoint)

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Check Bob: `http://localhost:3000`
- Check Paris: `http://localhost:3001/api/healthz`
- If Paris is wedged, re-run `bash scripts/dev-up.sh` (it kills stale `wrangler/workerd` processes before starting services).

