# DevStudio — Internal Toolbench

DevStudio is Clickeen's **local internal toolbench**.

It is where the internal human running Clickeen:
- tests and verifies widgets
- curates platform-owned content
- inspects runtime and deploy behavior from the local machine
- uses small local verification pages that do not belong in Roma

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

Future company-plane actions such as moderation, commercial overrides, support authority, or sponsored-account ops belong to the separate internal control plane, not to Berlin product roles and not to a fake DevStudio account shell.

## Environment

### Local

URL: `http://localhost:5173`

Purpose:
- fast internal toolbench on the owner machine
- widget curation and verification

Local contract:
- local DevStudio does **not** require Roma-style login semantics by default
- local DevStudio is never treated as a product user session or account-switch authority
- the removed widget-authoring workspace must not be recreated through a new hidden local API lane

There is no canonical Cloudflare DevStudio runtime.

## Shipped tools

The local widget-authoring workspace at `/#/tools/dev-widget-workspace` is removed.
DevStudio no longer hosts a local Bob widget-authoring lane.
That removal is intentional: DevStudio remains the internal toolbench, but it is no longer an alternate widget workspace host.

Current local tool surface includes:
- `/#/tools/bob-ui-native`
- `/#/tools/entitlements`
- Dieter previews and generated component/foundation documentation

### Dieter / design-system pages

DevStudio still hosts the Dieter previews and generated component documentation.
That remains a valid internal-toolbench use case.

Local lane note:
- `bash scripts/dev-up.sh` starts the local DevStudio operating lane, seeds required local platform state, and verifies the local stack before finishing
- use `pnpm dev:seed:platform` and `pnpm dev:verify:platform` only when you want to rerun those steps explicitly
- do not reintroduce cloud-derived or blob-only repair logic into boot

Removed local lanes:
- `/#/tools/dev-widget-workspace`
- local `/api/devstudio/control/*` action lanes for support/commercial operations

## Troubleshooting

### DevStudio local no longer hosts widget editing

This is intentional.
If you need the active widget-editing product lane, use Roma as the host surface.
Do not reintroduce a hidden DevStudio widget workspace to work around product-path issues.

### DevStudio local no longer hosts company-plane mutation actions

This is also intentional.
If an operation needs real support, sponsorship, moderation, or commercial authority, it belongs in the separate internal control plane rather than hidden local DevStudio routes.
