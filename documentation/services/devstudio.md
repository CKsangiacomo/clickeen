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

Cloudflare Access is not the DevStudio auth boundary.

## Current Surface

DevStudio has three sections:

- **Foundations** — Colors, Typography, Icons.
- **Dieter Components** — generated/static component showcase pages.
- **Policy** — the entitlements and AI runtime Policy Editor.

The old Bob UI Native husk is removed. The old local widget-authoring workspace is
also removed. Widget editing belongs to the real Roma -> Bob -> Tokyo product path.

## Runtime Model

DevStudio deploys as the `devstudio` Cloudflare Pages project. Its Pages fallback
host is `devstudio-dev.pages.dev`; that host is not canonical and must redirect or
be blocked unless Cloudflare project health checks require otherwise.

The Vite build remains the static app bundle. The policy API is implemented as
Pages Functions in `admin/functions/`; local Vite middleware must not own policy,
theme, or icon rebuild write APIs.

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
Invalid edits return typed failures and do not commit. GitHub SHA conflicts return
typed conflicts and require a refetch/retry.

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
`DEVSTUDIO_GITHUB_TOKEN` Pages secret from root `.env.local`.

## Local Development

Use package-level local DevStudio only for fast static UI iteration:

```bash
pnpm --filter @clickeen/devstudio dev
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

`scripts/dev-up.sh` does not start DevStudio. Local DevStudio is not product-state
evidence, does not replace the cloud surface, and must not reintroduce hidden local
write lanes.

## Build-Time Generation

DevStudio generates Dieter/component showcase pages at build time:

- `scripts/generate-component-pages.ts`
- `scripts/generate-icons-showcase.local.cjs`
- `scripts/generate-typography-json.cjs`

Generated showcase pages mirror Dieter source. They do not define component
behavior.
