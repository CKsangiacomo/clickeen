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
