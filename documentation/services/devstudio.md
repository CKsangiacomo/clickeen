# DevStudio — Internal Tools (Admin)

DevStudio is Clickeen’s internal admin surface for docs + tools. In this repo it lives in `admin/` (Vite).

## Environments

- **DevStudio Local** (`http://localhost:5173`)
  - Superadmin shell for development.
  - Default runtime profile is `product` (cloud Bob/Tokyo/Berlin/Paris data plane).
  - `source` profile is explicit and local-stack oriented (`?profile=source&bob=http://localhost:3000&tokyo=http://localhost:4000`).
- **DevStudio Cloudflare** (`https://devstudio.dev.clickeen.com`)
  - Fast “did the deploy work?” verification surface.
  - Treated as **read-only by default**.
  - If Widget Workspace is opened there with `?bob=http://localhost:3000`, the page is only a remote shell attached to your local Bob toolchain. Any writes still go through that local Bob/Paris stack and its chosen Supabase target.

## Widget Workspace tool

Route: `/#/tools/dev-widget-workspace`

What it does:
- Embeds Bob in message-boot mode as a widget authoring shell.
- Product profile default: cloud Bob + cloud Tokyo.
- Source profile override: local Bob + local Tokyo.
- Marks iframe host intent as `surface=devstudio` (pairs with `surface=roma` in Roma Builder for explicit host behavior).
- Uses Bob’s same-origin named routes only (`/api/roma/templates`, `/api/accounts/*`, `/api/widgets/*`) (DevStudio never calls Paris directly).
- Local-only trusted convenience is source-profile scoped (`ENV_STAGE=local`). Product profile stays on normal cloud auth/account checks.
- Uses a 2-dropdown flow:
  - first dropdown = widget type
  - second dropdown = admin-account `wgt_main_*` / `wgt_curated_*` rows available for that widget
- The dropdown data comes from `GET /api/roma/templates?accountId=<admin-account-id>&surface=devstudio`.
- Opening a selection lazy-loads the full admin-account instance envelope, then message-boots Bob with real `{ accountId, publicId }` context.
- Current superadmin authoring actions remain available through the same Bob routes:
  - update the baseline `wgt_main_*` row / default config
  - create or update curated rows
  - promote curated rows to cloud-dev
  - inspect translation status and enqueue translation work
- Source-only local file mutation actions are explicitly gated to `profile=source`:
  - `Update Config` (`/api/widget-spec-defaults`)
  - `Update Theme` (`/api/themes/list`, `/api/themes/update`)
  Product profile keeps these actions hidden and endpoints unavailable by design.

Source: `admin/src/html/tools/dev-widget-workspace.html`.

### Entitlements matrix (AI / LLM access)

DevStudio has two separate gates for Copilot behavior:
- **Profile/model gate** (AI / LLM Access): which providers/models are allowed by tier/profile.
- **Agent runtime gate** (per-agent execution): which agent IDs can execute for each tier/profile.

Important behavior:
- Unlimited budget values alone do not enable CS Copilot.
- For paid profiles (`tier1|tier2|tier3`), both gates must allow a CS-capable provider/model and runtime access for `cs.widget.copilot.v1`.
- Free + Minibob remain constrained to `sdr.widget.copilot.v1` by design.

Current boundary:
- Widget Workspace is restored for widget authoring, not for full local product parity.
- That includes admin-account baseline/curated iteration and translation checks inside Bob.
- The tool no longer pretends DevStudio is the operational owner for day-2 widget/account workflows.
- Product/admin operational work still belongs in Roma cloud with a real admin account.

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Product profile default checks:
  - Bob cloud: `https://bob.dev.clickeen.com`
  - Paris cloud: `https://paris.dev.clickeen.com/api/healthz`
- Source profile checks:
  - Bob local: `http://localhost:3000`
  - Paris local: `http://localhost:3001/api/healthz`
  - If local workers are wedged, re-run `bash scripts/dev-up.sh --source --reset`.
