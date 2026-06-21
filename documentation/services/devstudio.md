# DevStudio — Internal Toolbench

DevStudio is Clickeen's internal platform toolbench, served from Cloudflare Pages.

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
the DevStudio Pages finish route after Berlin login. Those cookies are for the
internal toolbench only; Roma/Bob product sessions do not consume DevStudio
cookies, and DevStudio must not consume customer product-session cookies.

Cloudflare Access is not the DevStudio auth boundary.

## Current Surface

DevStudio has three sections:

- **Foundations** — Colors, Typography, Icons.
- **Dieter Components** — generated/static component showcase pages.
- **Policy** — the entitlements and AI runtime Policy Editor.
- **LLM Management** — planned internal management surface for Clickeen model
  configuration and generated conformance evidence.

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
- `pnpm ai:model-conformance -- --write` generates
  `documentation/ai/model-conformance/latest.json` and
  `documentation/ai/model-conformance/latest.md` from that managed config. These
  files are evidence, not product runtime dependencies.
- The managed config declares all Product Copilot enabled models and one
  Clickeen default. Later San Francisco/Roma/Bob slices consume that config.
  The picker itself owns no model truth.
- SDR Copilot has no public model picker. DevStudio may manage its future model
  policy, but public/prospect users never choose a model.
- Internal agents use internal model routing config, not picker UI.
- DevStudio displays and edits managed configuration; San Francisco remains the
  runtime model execution authority. DevStudio must not directly mutate live
  worker runtime state or provider secrets.

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
