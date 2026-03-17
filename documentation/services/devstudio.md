# DevStudio — Internal Toolbench

DevStudio is Clickeen's **local internal toolbench**.

It is where the internal human running Clickeen:
- tests and verifies widgets
- curates platform-owned content
- hosts Bob for internal authoring flows
- inspects runtime and deploy behavior from the local machine
- uses internal-only tools that do not belong in Roma

DevStudio is **not**:
- Roma 2
- a customer account shell
- a browse-all-accounts dashboard
- a global superadmin portal
- a canonical Cloudflare or `cloud-dev` runtime
- the place to test customer auth/session realism by default

## Boundary

- `Roma` = customer/member shell
- `DevStudio` = local internal toolbench
- `Bob` = editor kernel
- `Berlin` = canonical product identity/account boundary

DevStudio may surface internal tools for Clickeen operations, but it must not invent a second account model or teach internal humans to act like privileged customers browsing accounts.

Future company-plane actions such as moderation, commercial overrides, and support authority belong to the separate internal control plane, not to Berlin product roles and not to a fake DevStudio account shell.

## Environment

### Local

URL: `http://localhost:5173`

Purpose:
- fast internal toolbench on the owner machine
- widget curation and verification
- local Bob host for internal authoring
- local internal-only tool routes under `/api/devstudio/*`

Local contract:
- `GET /api/devstudio/context` returns the seeded platform account context for the local toolbench
- response shape is minimal and internal-tool-only:
  - `accountId`
  - `scope: 'platform'`
  - `mode: 'local-tool'`
- local DevStudio does **not** require Roma-style login semantics by default
- local DevStudio tool authority is confined to `/api/devstudio/*`
- local DevStudio is never treated as a product user session or account-switch authority
- local tool routes currently shipped in the Vite middleware are:
  - `GET /api/devstudio/context`
  - `GET /api/devstudio/widgets`
  - `GET|PUT /api/devstudio/instance`
  - `GET /api/devstudio/instance/localization`
  - `PUT|DELETE /api/devstudio/instance/localization/user`
  - `GET /api/devstudio/instances/:publicId/l10n/status`
  - `/api/devstudio/assets*`

There is no canonical Cloudflare DevStudio runtime.

## Shipped tools

### Dev Widget Workspace

Route: `/#/tools/dev-widget-workspace`

What it does:
- embeds Bob for internal widget authoring/testing
- lists platform-owned instances through local DevStudio routes
- uses the local DevStudio context to resolve the platform account
- sends Bob a complete host-owned editor envelope (`compiled`, `config`, localization snapshot, policy, instance meta)
- delegates Bob account mutations plus localization snapshot/status reads back through explicit local DevStudio tool routes instead of letting Bob call customer account routes directly

Key routes used by this tool:
- `GET /api/devstudio/context`
- `GET /api/devstudio/widgets`
- `GET|PUT /api/devstudio/instance`
- `GET /api/devstudio/instance/localization`
- `PUT|DELETE /api/devstudio/instance/localization/user`
- `GET /api/devstudio/instances/:publicId/l10n/status`
- `/api/devstudio/assets*`

Implementation note:
- the surviving DevStudio local-tool routes are explicit Vite middleware routes
- current runtime does not ship a Paris-backed DevStudio proxy layer
- DevStudio local must not rely on Roma bootstrap capsules or customer auth semantics

Current local implementation layout:
- [dev-widget-workspace.html](/Users/piero_macpro/code/VS/clickeen/admin/src/html/tools/dev-widget-workspace.html) is now a thin shell for the tool page
- [main.js](/Users/piero_macpro/code/VS/clickeen/admin/src/tools/dev-widget-workspace/main.js) is the workspace composition/runtime shell
- [api.js](/Users/piero_macpro/code/VS/clickeen/admin/src/tools/dev-widget-workspace/api.js) owns local-tool transport and DevStudio instance/l10n reads-writes
- [bob-host.js](/Users/piero_macpro/code/VS/clickeen/admin/src/tools/dev-widget-workspace/bob-host.js) owns compiled-widget fetch, full Bob open-editor envelope assembly, and iframe boot
- [state.js](/Users/piero_macpro/code/VS/clickeen/admin/src/tools/dev-widget-workspace/state.js) owns widget/publicId/local-instance helper logic
- [devstudio.ts](/Users/piero_macpro/code/VS/clickeen/admin/vite/devstudio.ts) owns the DevStudio Vite middleware/proxy family
- [vite.config.ts](/Users/piero_macpro/code/VS/clickeen/admin/vite.config.ts) is now the Vite shell plus plugin registration, not the hidden DevStudio proxy runtime

What it does not do:
- browse customer accounts
- switch customer account context
- expose a generic internal account shell

### Sponsored account onboarding

Route: `/#/tools/sponsored-account-onboarding`

What it does:
- create tester accounts directly from DevStudio
- apply complimentary `tier3`
- issue owner invitations for the invited human

### Customer recovery

Route: `/#/tools/customer-recovery`

What it does:
- change a locked-out user's email
- remove a non-owner member from an account
- revoke a user's sessions
- pause or resume publishing for the current account-owned widget publish path
- open a targeted customer-owned widget in Bob for support intervention

Current support-intervention limits:
- local only
- targeted customer-owned widget only
- base-config save path only

### Dieter / design-system pages

DevStudio still hosts the Dieter previews and generated component documentation.
That remains a valid internal-toolbench use case.

## Local internal transport

The surviving local DevStudio tool routes use explicit internal-tool transport where needed:
- `CK_INTERNAL_SERVICE_JWT`
- `TOKYO_DEV_JWT`
- `x-ck-internal-service: devstudio.local`

These are valid only for explicit DevStudio local tool routes.
They must not be treated as product identity or account membership on product/account paths.

## Troubleshooting

### Local DevStudio shows no context or no instances

Check:
- local `GET /api/devstudio/context`
- local `CK_INTERNAL_SERVICE_JWT`
- local `TOKYO_DEV_JWT`
- the selected local runtime profile from `bash scripts/dev-up.sh`

### Widget editing works in Roma but not in DevStudio local

Check the explicit local DevStudio tool routes:
- `/api/devstudio/context`
- `/api/devstudio/widgets`
- `/api/devstudio/instances*`
- `/api/devstudio/instance*`
- `/api/devstudio/assets*`

If those fail, fix DevStudio local.
Do not patch product auth to make the internal tool appear to work.
