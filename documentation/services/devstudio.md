# DevStudio — Global Superadmin Portal

DevStudio is Clickeen’s platform-scoped superadmin and operator surface. It is how a human manages Clickeen itself across accounts, curated/platform-owned content, and explicit company/operator workflows. In this repo it lives in `admin/` (Vite).

Hard boundary:
- `Roma` is the account-scoped customer/member shell
- `DevStudio` is the platform-scoped Clickeen superadmin shell
- DevStudio may expose higher-privilege operator flows, but it must not invent a second account or provider truth model

## Environments

- **DevStudio Local** (`http://localhost:5173`)
  - Superadmin shell for development.
  - Default runtime profile is `product` (local Bob over the cloud Tokyo/Berlin data plane, with Paris limited to localization/orchestration rather than core instance open/save).
  - `source` profile is explicit and local-stack oriented (`?profile=source&bob=http://localhost:3000&tokyo=http://localhost:4000`).
- **DevStudio Cloudflare** (`https://devstudio.dev.clickeen.com`)
  - Fast “did the deploy work?” verification surface.
  - Treated as **read-only by default**.
  - If the instances tool is opened there with `?bob=http://localhost:3000`, the page is only a remote shell attached to your local Bob toolchain. Core create/open/save still go through that local Bob stack and its selected Tokyo/Michael target; Paris remains only for localization/orchestration.

## Admin Instances

Route: `/#/tools/dev-widget-workspace`

What it does:

- Embeds Bob in message-boot mode as a widget authoring shell.
- Product profile default: local Bob + cloud Tokyo.
- Source profile override: local Bob + local Tokyo.
- Marks iframe host intent as `surface=devstudio` (pairs with `surface=roma` in Roma Builder for explicit host behavior).
- Widget type selection still comes from the local widget catalog (`/api/devstudio/widgets`).
- DevStudio host-owned platform context comes from `GET /api/devstudio/context`; the browser tool does not carry its own hardcoded account truth.
- That route requires a real Berlin session/bootstrap plus platform-account membership and fails visibly when that context is missing or broken.
- Instance discovery comes from the explicit local DevStudio route family (`/api/devstudio/instances*`).
- The instance discovery/status routes must honor that same host-owned context decision before proxying any upstream work.
- DevStudio no longer uses `/api/roma/templates`. That route is Roma product starter discovery, not DevStudio authoring discovery.
- Product profile shows the current platform-owned account’s instances directly.
- DevStudio local instance discovery is explicitly platform-account scoped. It does not honor browser-side `accountId` overrides for this tool path.
- DevStudio local Tokyo asset routes are an explicit internal-tool path: they use `TOKYO_DEV_JWT` plus `x-ck-internal-service: devstudio.local`, not a generic trusted token bypass.
- Source profile keeps widget defaults available only when a widget has no saved instance yet.
- Uses a 2-dropdown flow:
  - first dropdown = widget type
  - second dropdown = the platform-owned instances for that widget
- The widget catalog comes from `GET /api/devstudio/widgets`.
- Instances come from `GET /api/devstudio/instances`.
- Opening the `wgt_main_*` instance or any other instance lazy-loads core instance state from Bob’s canonical same-origin route (`GET /api/accounts/:accountId/instance/:publicId?subject=account`) plus explicit localization rehydrate (`GET /api/accounts/:accountId/instances/:publicId/localization?subject=account`), then message-boots Bob with real `{ accountId, publicId }` context.
- Local startup explicitly repairs missing Tokyo saved authoring snapshots for historical `wgt_main_*` / `wgt_curated_*` rows before DevStudio opens them. This is a startup repair step, not read-time healing in Bob/DevStudio.
- Current authoring actions use:
  - list through the local DevStudio route family
  - open/save through Bob’s canonical same-origin account routes
  - inspect translation status
- Bob inside DevStudio receives explicit asset endpoints from the host page:
  - list/delete assets through `/api/devstudio/assets/:accountId`
  - upload assets through `/api/devstudio/assets/upload`
  - DevStudio does **not** use Roma/Bob product `/api/assets/*` routes for this tool path.
- Translation status is best-effort in DevStudio:
  - `GET /api/devstudio/instances/:publicId/l10n/status`
  - if local San Francisco is unavailable, DevStudio returns `200` with `unavailable: true` and the UI shows `Unavailable`
  - the editor remains usable; background status does not hard-fail the tool
- Source-only local file mutation actions are explicitly gated to `profile=source`:
  - `Update Theme` (`/api/themes/list`, `/api/themes/update`)
    Product profile keeps this action hidden and the endpoints unavailable by design.

Source: `admin/src/html/tools/dev-widget-workspace.html`.

## Account Operator

Route: `/#/tools/account-operator`

What it does:

- Exposes the current Berlin session's accessible accounts directly in DevStudio.
- Uses the same account/membership truth model as Roma; there is no DevStudio-only account architecture.
- Supports:
  - listing accessible accounts
  - creating a new account
  - inspecting canonical account detail
  - inspecting current members for an account
  - switching the active account preference
- Uses explicit local DevStudio Berlin-backed routes:
  - `GET /api/devstudio/accounts`
  - `POST /api/devstudio/accounts`
  - `GET /api/devstudio/accounts/:accountId`
  - `GET /api/devstudio/accounts/:accountId/members`
  - `POST /api/devstudio/accounts/:accountId/switch`
- These routes require a real Berlin product session plus platform-account membership.
- Like the instances tool, account-operator flows require a real Berlin session and platform-account membership; there is no trusted-local operator fallback.

Why:

- PRD 064 requires DevStudio account/operator flows to sit on Berlin truth rather than inventing a second operator model.
- Internal operator humans still use the same `User Profile + Account Memberships + one active account` model as product shells.

### Entitlements matrix (AI / LLM access)

DevStudio has two separate gates for Copilot behavior:

- **Profile/model gate** (AI / LLM Access): which providers/models are allowed by tier/profile.
- **Agent runtime gate** (per-agent execution): which agent IDs can execute for each tier/profile.

Important behavior:

- Unlimited budget values alone do not enable CS Copilot.
- For paid profiles (`tier1|tier2|tier3`), both gates must allow a CS-capable provider/model and runtime access for `cs.widget.copilot.v1`.
- Free + Minibob remain constrained to `sdr.widget.copilot.v1` by design.

Current boundary:

- DevStudio is the platform superadmin surface.
- The shipped toolset now includes:
  - Berlin-backed account operator flows for accessible accounts
  - platform-owned curated/widget authoring and verification flows
  - source-profile local theme mutations
- Customer account day-2 workflows still belong in Roma.
- Platform-scoped superadmin/operator workflows belong in DevStudio as they are implemented.
- The same instances are:
  - DevStudio authoring targets
  - Roma starter catalog entries
  - Prague embed sources

## Troubleshooting

If DevStudio local opens but instances are missing:

- Check DevStudio `GET /api/devstudio/context` first; the widget tool now requires a real Berlin session and fails visibly when that session is missing or broken.
- Check local `PARIS_DEV_JWT` only for the remaining local internal discovery/status transport. Bob `/api/accounts/...` availability now depends on a real Berlin session plus the bootstrap account capsule.
- Check that `bash scripts/dev-up.sh --reset` completed the explicit curated/main Tokyo saved snapshot repair step.
- DevStudio discovery/status remain local trusted-tool transport paths today, but they are host-gated by the same DevStudio context contract; core create/open/save now uses Bob’s canonical route instead of Paris.

If the Account Operator tool shows an auth or forbidden error:

- DevStudio account-operator routes require a real Berlin session.
- They also require membership in the platform-owned account.
- No trusted-local fallback exists for operator account data, by design.

If the asset picker is empty in DevStudio but Roma shows assets:

- DevStudio must read assets through `/api/devstudio/assets/:accountId`.
- This is a local trusted-tool path backed by `TOKYO_DEV_JWT` plus `x-ck-internal-service: devstudio.local`, not the product `/api/assets/*` route family.

If the page fails before any widget opens:

- Local DevStudio must be able to read `/api/devstudio/widgets`.
- Product profile default checks:
  - Bob local: `http://localhost:3000`
- Source profile checks:
  - Bob local: `http://localhost:3000`
  - If local workers are wedged, re-run `bash scripts/dev-up.sh --source --reset`.
