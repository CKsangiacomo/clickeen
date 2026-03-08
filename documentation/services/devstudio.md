# DevStudio — Internal Tools (Admin)

DevStudio is Clickeen’s internal admin surface for docs + tools. In this repo it lives in `admin/` (Vite).

## Environments

- **DevStudio Local** (`http://localhost:5173`)
  - Superadmin shell for development.
  - Default runtime profile is `product` (cloud Bob/Tokyo/Berlin data plane with a local Paris trusted boundary for admin instance routes).
  - `source` profile is explicit and local-stack oriented (`?profile=source&bob=http://localhost:3000&tokyo=http://localhost:4000`).
- **DevStudio Cloudflare** (`https://devstudio.dev.clickeen.com`)
  - Fast “did the deploy work?” verification surface.
  - Treated as **read-only by default**.
  - If the instances tool is opened there with `?bob=http://localhost:3000`, the page is only a remote shell attached to your local Bob toolchain. Any writes still go through that local Bob/Paris stack and its chosen Supabase target.

## Admin Instances

Route: `/#/tools/dev-widget-workspace`

What it does:
- Embeds Bob in message-boot mode as a widget authoring shell.
- Product profile default: cloud Bob + cloud Tokyo, with instance discovery/edit reads proxied through local Paris.
- Source profile override: local Bob + local Tokyo.
- Marks iframe host intent as `surface=devstudio` (pairs with `surface=roma` in Roma Builder for explicit host behavior).
- Widget type selection still comes from the local widget catalog (`/api/devstudio/widgets`).
- Instance discovery now comes from the explicit local DevStudio route family (`/api/devstudio/instances*`), which proxies to the local Paris trusted boundary.
- DevStudio no longer uses `/api/roma/templates`. That route is Roma product starter discovery, not DevStudio authoring discovery.
- Product profile shows the admin account’s instances directly.
- Source profile keeps widget defaults available only when a widget has no saved instance yet.
- Uses a 2-dropdown flow:
  - first dropdown = widget type
  - second dropdown = the admin instances for that widget
- The widget catalog comes from `GET /api/devstudio/widgets`.
- Instances come from `GET /api/devstudio/instances?accountId=<admin-account-id>`.
- Opening the `wgt_main_*` instance or any other instance lazy-loads the full admin-account instance envelope through `GET /api/devstudio/instances/:publicId`, then message-boots Bob with real `{ accountId, publicId }` context.
- Current authoring actions use the same local DevStudio route family:
  - create/update instances
  - inspect translation status
  - enqueue translation work
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
- The DevStudio tool is restored for widget authoring, not for full local product parity.
- That includes editing the admin account’s instances and running translation checks inside Bob.
- The tool no longer pretends DevStudio is the operational owner for day-2 widget/account workflows.
- Product/admin operational work still belongs in Roma cloud with a real admin account.
- The same instances are:
  - DevStudio authoring targets
  - Roma starter catalog entries
  - Prague embed sources

## Troubleshooting

If DevStudio local opens but instances are missing:
- Check local `PARIS_DEV_JWT` / Paris connectivity for `/api/devstudio/instances`.
- This is a local trusted-tool path, not a Roma product-auth path.

If the page fails before any widget opens:
- Local DevStudio must be able to read `/api/devstudio/widgets`.
- Product profile default checks:
  - Bob cloud: `https://bob.dev.clickeen.com`
- Source profile checks:
  - Bob local: `http://localhost:3000`
  - If local workers are wedged, re-run `bash scripts/dev-up.sh --source --reset`.
