# DevStudio — The One Human's Cockpit for an AI-Operated Company

**DevStudio is the one human's cockpit for governing an AI-operated company.**

Clickeen is built and operated by an AI fleet under one human who cannot read every diff or watch every agent run. DevStudio is the single surface where that human governs the company: by LOOKING at rendered truth (design, product, agents, content, runtime state) and STEERING through named authorities with validated commits.

What DevStudio shows must be derived truth — never hand-editable — because the moment the supervised can edit what the human looks at, supervision is impossible.

DevStudio is served from Cloudflare Pages.

Canonical URL:

```text
https://devstudio.clickeen.com
```

## Boundary

- DevStudio is not Roma 2.
- DevStudio is not a customer account shell.
- DevStudio is not a global superadmin dashboard.
- DevStudio does not own widget authoring truth.
- DevStudio does not create a second account model, allowlist model, or auth bypass.

Berlin/Google login is the only DevStudio auth boundary. The signed-in user must
resolve through Berlin bootstrap to the normal Clickeen admin account
(`accountPublicId: "CLICKEEN"`) with an admin/owner role. `CLICKEEN` is a normal
account coordinate, not a superadmin bypass.

DevStudio uses host-scoped session cookies on `devstudio.clickeen.com`, set by
the DevStudio Pages finish route after Berlin login. Those cookies are for DevStudio only; Roma/Bob product sessions do not consume DevStudio
cookies, and DevStudio must not consume customer product-session cookies.

Cloudflare Access is not the DevStudio auth boundary.

## Current Surface

DevStudio has these sections:

- **Foundations** — Colors, Typography, Icons.
- **Dieter Components** — generated/static component showcase pages.
- **Policy** — the entitlements and AI runtime Policy Editor.
- **LLM Management** — read-only internal visibility into Clickeen managed model
  configuration.

The old Bob UI Native husk is removed. The old local widget-authoring workspace is
also removed. Widget editing belongs to the real Roma -> Bob -> Tokyo product path.

## Runtime Model

DevStudio deploys as the `devstudio` Cloudflare Pages project. Its Pages fallback
host is `devstudio-dev.pages.dev`; that host is not canonical and must redirect or
be blocked unless Cloudflare project health checks require otherwise.

The static app bundle is produced by `admin/scripts/build-static.mjs`. The policy
API is implemented as Pages Functions in `admin/functions/`; local dev-server
middleware must not own policy, theme, or icon rebuild write APIs.

Policy routes:

```text
GET  /api/entitlements/matrix
POST /api/entitlements/matrix/cell
GET  /api/ai-runtime/matrix
POST /api/ai-runtime/matrix/cell
```

Policy reads use the GitHub contents API against current `main`, so the editor
shows committed policy state rather than the Pages build snapshot. Policy writes
apply `@clickeen/ck-policy` validators and commit updated JSON back to `main`.
Every policy API request verifies the Berlin session and Clickeen admin account
context before reading or writing. Invalid edits return typed failures and do not
commit. GitHub SHA conflicts return typed conflicts and require a refetch/retry.

LLM management source:

- `@clickeen/ck-contracts/ai` owns model candidate facts.
- `@clickeen/ck-contracts/ai-model-management` owns the managed model
  configuration shape and current source-controlled config artifact.
- The managed config declares all Product Copilot enabled models and one
  Clickeen default. Roma/Bob consume it for grant issuance and picker display.
  San Francisco executes the model route in the signed runtime policy and does
  not read documentation files as runtime model truth. The picker itself owns no
  model truth.
- Internal agents use internal model routing config, not picker UI.
- DevStudio displays managed configuration; San Francisco remains the runtime
  model execution authority. The current shipped DevStudio surface is
  read-only: it displays committed managed config at
  `/#/policy/llm-management`. DevStudio must not directly mutate live worker
  runtime state or provider secrets.

Required Pages configuration:

- `BERLIN_BASE_URL`
- `DEVSTUDIO_CANONICAL_ORIGIN`
- `DEVSTUDIO_GITHUB_BRANCH`
- `DEVSTUDIO_GITHUB_REPOSITORY`
- `ENV_STAGE`
- `DEVSTUDIO_GITHUB_TOKEN` as a Pages secret

`admin/wrangler.toml` is the source of truth for non-secret Pages configuration
once the Cloudflare Pages project root is `admin`. Use
`pnpm cf:pages:devstudio-env` from the repo root to compare live Pages env against
that file without exposing secret values. Use
`pnpm cf:pages:sync-devstudio-env --apply` to write the non-secret vars and the
required Pages secrets from root `.env.local`.

## Local Runtime

DevStudio product evidence comes from the Berlin-authenticated Cloudflare Pages
surface, not from a local dev server. Local runtime work must not reintroduce
hidden local write lanes.

Use package-level checks for build and Pages Functions verification:

```bash
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

## Build-Time Generation

DevStudio generates Dieter/component showcase pages before build:

- `scripts/generate-component-pages.ts`
- `scripts/generate-typography-json.cjs`
- `scripts/generate-static-registries.mjs`

Generated showcase pages mirror Dieter source. They do not define component
behavior.
