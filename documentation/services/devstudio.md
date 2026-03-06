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
- Embeds Bob in message-boot mode as a local-first widget authoring studio (default local Bob or explicit `?bob=http://localhost:3000` on the page URL).
- Marks iframe host intent as `surface=devstudio` (pairs with `surface=roma` in Roma Builder for explicit host behavior).
- Opens Bob from one of two honest sources:
  - **Source defaults**: compiles `tokyo/widgets/{widget}/spec.json` through Bob and opens an in-memory session with no persisted row required.
  - **Saved starter**: loads an existing admin-account baseline/curated row through Bob named routes and opens Bob with real `{ accountId, publicId }` context.
- Uses Bob’s same-origin named routes only (`/api/roma/templates`, `/api/accounts/*`, `/api/widgets/*`) (DevStudio never calls Paris directly).
- Local-only unauth convenience is isolated here: DevStudio Local carries explicit `devstudio` surface markers so Bob can mint local sessions only for this toolchain, and only when `ENV_STAGE=local`. Roma/product routes do not get this bypass.
- Uses a 2-step flow: pick `Widget slug`, then choose `Source defaults` or a saved starter scoped to that widget.
- Starter list fetch uses `GET /api/roma/templates?accountId=<admin-account-id>&surface=devstudio`.
- Starter opens lazy-load the full admin-account instance envelope on selection.
- In-memory source-default sessions are for zero-to-one spec/runtime iteration. Saved-starter sessions are the path that keeps Bob save/publish/localization behavior alive.

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
- Widget Workspace is restored for zero-to-one authoring, not for full local product parity.
- The tool no longer pretends DevStudio is the operational owner for day-2 widget/account workflows.
- Product/admin operational work still belongs in Roma cloud with a real admin account.

## Troubleshooting

If the instance dropdown shows “Error loading instances”:
- Check Bob: `http://localhost:3000`
- Check Paris: `http://localhost:3001/api/healthz`
- If Paris is wedged, re-run `bash scripts/dev-up.sh` (it kills stale `wrangler/workerd` processes before starting services).
