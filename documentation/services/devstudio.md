# DevStudio - Human Cockpit For The AI-Operated Company

STATUS: CURRENT SYSTEM OPERATOR SPEC

DevStudio is the Cloudflare Pages cockpit where the one human governs the AI-operated company. It shows rendered/source-controlled truth and allows steering only through named Pages Functions that validate input and commit to `main`.

DevStudio is not Roma, not Bob, not a customer account shell, and not a general admin bypass. The signed-in human must resolve through Berlin to the normal Clickeen admin account:

```text
accountPublicId: CLICKEEN
```

## Runtime Authority

| Concern | Current authority |
| --- | --- |
| App source | `admin/` |
| Cloudflare Pages project | `devstudio` |
| Canonical host | `https://devstudio.clickeen.com` |
| Production branch | `main` |
| Build command | `pnpm build` |
| Build output | `admin/dist` |
| Auth/session | Berlin login + DevStudio Pages session finish route |
| Write path | Pages Functions under `admin/functions/**` |
| Commit branch | `DEVSTUDIO_GITHUB_REPOSITORY` + `DEVSTUDIO_GITHUB_BRANCH` |

Non-canonical Pages origins redirect or block through `admin/functions/_middleware.js` unless Cloudflare project health behavior requires otherwise.

## Workspace Capability

DevStudio follows the global operational-workspace tenet in
`documentation/engineering/UI/surfaces.md`: full desktop workspace on desktop
and tablets in either orientation; compact drawer navigation on mobile
landscape; explicit unsupported boundary on mobile portrait. Retina/4K density
governs sharpness, not layout class. The current unwired generic `960px`
off-canvas state is a 126L execution gap, not product law. DevStudio keeps one
simple shell: persistent narrow left navigation plus a flexible work area in
full mode, and the same navigation as an overlay drawer plus a full-width work
area in compact mode. Reveal and policy pages are not rebuilt as mobile
variants.

## Token Editor Dialog

The token editor follows accepted D1 dismissal law. Escape closes only when the
editor is unchanged. Dirty dismissal opens discard confirmation, backdrop
dismissal is disabled, Cancel follows the same dirty rule, and Confirm Commit
persists through the existing validated write lane. Native `beforeunload`, where
needed at the browser boundary, is not replaced by an in-product dialog helper.
Any current token-editor behavior that differs is a 126L execution gap.

## Current Sections

| Section | Runtime source |
| --- | --- |
| Foundations: Colors, Typography, Icons | Generated from Dieter source and DevStudio static page generation. |
| Dieter Components | Generated/static component showcase pages from Dieter component specs and snippets. |
| Entitlements | Pages Functions read/write entitlement policy files through GitHub. The same tool also renders AI runtime policy editing backed by `/api/ai-runtime/*`. |
| LLM Management | Read-only generated visibility into managed model configuration. It is not a runtime API-backed editor. |

Hash routes are generated from `admin/src/html/**` and route data in `admin/src/data/routes.ts`. There is no separate design-system admin app.

## Pages Functions

| Route | Purpose |
| --- | --- |
| `GET /api/entitlements/matrix` | Read committed entitlement matrix. |
| `POST /api/entitlements/matrix/cell` | Validate and commit one entitlement matrix edit. |
| `GET /api/ai-runtime/matrix` | Read committed AI runtime policy matrix. |
| `POST /api/ai-runtime/matrix/cell` | Validate and commit one AI runtime policy edit. |
| `GET /api/session/login/google` | Start Berlin login for DevStudio. |
| `GET /api/session/finish` | Redeem Berlin finish transaction and set DevStudio session cookie. |
| `GET /api/dieter/tokens/colors` | Read source-controlled Dieter color tokens. |
| `POST /api/dieter/tokens/colors/value` | Validate and commit one Dieter color token edit. |
| `GET /api/dieter/tokens/typography` | Read source-controlled Dieter typography tokens. |
| `POST /api/dieter/tokens/typography/value` | Validate and commit one Dieter typography token edit. |

Every write uses GitHub SHA conflict checks. A stale write fails; it does not overwrite current `main`.

## Color Reveal And Write Truth

DevStudio reveals Dieter color source truth. Current color writes are intentionally
narrow: only `--color-*` tokens with literal hex values are editable through the
color token write lane.

Role, focus, state, and derived `color-mix(...)` rows are displayed as read-only
truth. They are not hidden, but they do not masquerade as writable DevStudio
controls.

## Icon Reveal Truth

DevStudio/Admin uses generated raw Dieter SVG imports for tooling and reveal.
That path is not a product runtime icon system. Missing `[data-icon]` truth is
rendered visibly as `[missing icon: name]` with `data-icon-missing`, not silently
omitted or replaced.

## Auth And Safety Gates

DevStudio APIs stop on:

- missing Berlin config or invalid Berlin session
- account not equal to `CLICKEEN`
- role not `owner` or `admin`
- invalid POST origin
- invalid persisted policy or token file
- GitHub read/write failure
- GitHub SHA conflict

Cloudflare Access is not the DevStudio auth boundary.

## Environment

Configured in `admin/wrangler.toml` and Cloudflare Pages:

| Name | Purpose |
| --- | --- |
| `BERLIN_BASE_URL` | Berlin session/finish verification. |
| `DEVSTUDIO_CANONICAL_ORIGIN` | Canonical host enforcement. |
| `DEVSTUDIO_GITHUB_BRANCH` | Commit branch, currently `main`. |
| `DEVSTUDIO_GITHUB_REPOSITORY` | Repository for source-controlled writes. |
| `ENV_STAGE` | Runtime stage label. |
| `DEVSTUDIO_GITHUB_TOKEN` | Pages secret for GitHub contents reads/writes. |

Cloudflare API commands require root `.env.local` values:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_REST_API_TOKEN
```

`DEVSTUDIO_GITHUB_TOKEN` is required when syncing DevStudio Pages env/secrets or
when DevStudio runtime Pages Functions read/write repository contents. General
Cloudflare project/domain reads do not require it.

Do not document secret values.

## Build And Verification

DevStudio generation:

```bash
pnpm --filter @clickeen/devstudio generate
```

Build/checks:

```bash
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio lint
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

Cloudflare Pages verification:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project devstudio
pnpm cf:pages:devstudio-env
```

Runtime evidence:

```text
https://devstudio.clickeen.com
```

Use Berlin-authenticated browser evidence for product truth.

## Hard Stops

Do not use DevStudio to:

- edit customer account data
- host widget authoring
- bypass Roma/Bob/Tokyo product paths
- mutate live worker runtime state directly
- store or display secret values
- create a parallel account, allowlist, model, or policy authority
