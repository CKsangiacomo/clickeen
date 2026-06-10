# Cloudflare Pages Cloud-Dev Checklist

Status: FINAL STATE AFTER PRD 063 + PRD 099B DEPLOY ROOT CONTRACT
Owner: Human architect for dashboard alignment; repo/runtime owners for app-local build contracts

This checklist is the canonical manual setup contract for Cloudflare Pages `cloud-dev`.

Rules:
- Cloudflare Pages Git build is the deploy plane for Bob, Roma, and Prague.
- Tokyo/R2 git-authored deploy roots are `dieter/`, `fonts/`, `product/`, and `prague/`; only `accounts/` is runtime-managed account storage.
- Tokyo Pages/static output is a source/deploy and friendly-serving convenience. It must not become a second authority for product widget software, Dieter media, fonts, product media, or Prague content.
- Widget software is served from canonical R2 `product/widgets/**`. Friendly `/widgets/**` routes must resolve there, not to root `widgets/**` or stale static output.
- Prague page translations deploy beside page JSON under `prague/pages/{widget}/{page}.translations/{locale}.json`, never under root `l10n/**`.
- GitHub Actions must not create Pages projects or sync Pages secrets.
- Each app builds from its own root and writes only to its own output directory.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts for authenticated Builder flows. `*.pages.dev` is not a valid public runtime host for those apps.
- Bob and Roma keep host/base-URL runtime vars in app-local `wrangler.toml`. Supabase project values are live environment config, not committed repo literals.
- Bob and Roma `wrangler.toml` files must stay within the Pages-supported schema. Worker-only blocks such as top-level `observability` or named environments like `local` are not valid Pages config.
- Prague keeps runtime vars in the Cloudflare Pages dashboard because it does not use app-local Wrangler config today.
- DevStudio is the canonical internal Pages toolbench at `https://devstudio.clickeen.com`.
- GitHub runtime verification stays unauthenticated until a real provider-based test adapter exists; do not keep public password login for smoke coverage.
- Authenticated cloud-dev smoke is manual Google login, Roma bootstrap, Builder open/save, Widgets read, locales, assets, and logout.
- Berlin/Roma product auth, bootstrap, Builder, account registry, Tokyo, and Tokyo-worker account-control paths must not require shared-secret bearer auth. Internal San Francisco tooling requests use signed request bodies.

## Bob

Project:
- `bob-dev`

Git settings:
- Repo: `CKsangiacomo/clickeen`
- Production branch: `main`
- Root directory: `bob`
- Build command: `pnpm build:cf`
- Output directory: `.cloudflare/output/static`
- Deploy trigger: Git-connected Cloudflare Pages build only
- Build note: `pnpm build:cf` keeps the final Pages artifact app-local, but temporarily writes repo-root `.vercel/project.json` with `rootDirectory: 'bob'` because Vercel's monorepo Next.js builder still requires that metadata.

Public host:
- Canonical host: `https://bob.dev.clickeen.com`
- Required: yes
- `*.pages.dev` allowed as public runtime host: no

Env contract:

| Variable | Required | Cloud-dev value | Source-of-truth owner |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_TOKYO_URL` | yes | `https://tokyo.dev.clickeen.com` | `bob/wrangler.toml` |
| `NEXT_PUBLIC_CLK_LIVE_URL` | optional | `https://dev.clk.live` | `bob/wrangler.toml` |
| `BERLIN_BASE_URL` | yes | `https://berlin-dev.clickeen.workers.dev` | `bob/wrangler.toml` |
| `SUPABASE_URL` | yes | `https://ebmqwqdexmemhrdhkmwn.supabase.co` | Cloudflare Pages dashboard + GitHub Actions env |
| `SUPABASE_ANON_KEY` | yes | cloud-dev anon key for project `ebmqwqdexmemhrdhkmwn` | Cloudflare Pages dashboard + GitHub Actions env |
| `SANFRANCISCO_BASE_URL` | yes | `https://sanfrancisco.dev.clickeen.com` | `bob/wrangler.toml` |

Dashboard action:
- Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Cloudflare Pages dashboard for the live Bob app.
- Keep the host/base-URL vars in `bob/wrangler.toml`.
- Runtime flags: `nodejs_compat`, `nodejs_compat_populate_process_env`

## Roma

Project:
- `roma-dev`

Git settings:
- Repo: `CKsangiacomo/clickeen`
- Production branch: `main`
- Root directory: `roma`
- Build command: `pnpm build:cf`
- Output directory: `.vercel/output/static`
- Deploy trigger: Git-connected Cloudflare Pages build only
- Build note: `pnpm build:cf` keeps the final Pages artifact app-local, but temporarily writes repo-root `.vercel/project.json` with `rootDirectory: 'roma'` because Vercel's monorepo Next.js builder still requires that metadata.

Public host:
- Canonical host: `https://roma.dev.clickeen.com`
- Required: yes
- `*.pages.dev` allowed as public runtime host: no

Env contract:

| Variable | Required | Cloud-dev value | Source-of-truth owner |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_TOKYO_URL` | yes | `https://tokyo.dev.clickeen.com` | `roma/wrangler.toml` |
| `BERLIN_BASE_URL` | yes | `https://berlin-dev.clickeen.workers.dev` | `roma/wrangler.toml` |
| `NEXT_PUBLIC_BOB_URL` | yes | `https://bob.dev.clickeen.com` | `roma/wrangler.toml` |
| `SUPABASE_URL` | yes | `https://ebmqwqdexmemhrdhkmwn.supabase.co` | Cloudflare Pages dashboard + GitHub Actions env |
| `SUPABASE_ANON_KEY` | yes | cloud-dev anon key for project `ebmqwqdexmemhrdhkmwn` | Cloudflare Pages dashboard + GitHub Actions env |

Dashboard action:
- Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Cloudflare Pages dashboard for the live Roma app.
- Keep the host/base-URL vars in `roma/wrangler.toml`.
- Configure the `TOKYO_ASSET_CONTROL` service binding on Roma Pages to target the `tokyo-assets-dev` worker.
- Configure the `TOKYO_PRODUCT_CONTROL` service binding on Roma Pages to target the `tokyo-assets-dev` worker.
- Runtime flags: `nodejs_compat`, `nodejs_compat_populate_process_env`

## Public Embeds

Public widget serving is not a Pages project. Cloud-dev routes public embeds through `dev.clk.live` static serving backed by the cloud-dev Tokyo-worker and cloud-dev Tokyo/R2 generated instance files.

Rules:
- `dev.clk.live` is the cloud-dev public-serving host.
- `clk.live` is reserved for production public serving.
- The path shape is identical across environments: `/{accountPublicId}/{instanceId}`.
- Do not bind the cloud-dev Tokyo worker to `clk.live`.
- Tokyo-worker owns the cloud-dev public route in Cloudflare zone infra: `dev.clk.live/*` routes to `tokyo-assets-dev`, with `PUBLIC_SERVING_BASE_URL=https://dev.clk.live`.
- The cloud-dev worker deploy script uploads worker code with `wrangler deploy --routes ""`; route/DNS mutation is zone infrastructure and must not be retried blindly from the worker deploy token.
- The public-serving hostname must host-gate Tokyo: `dev.clk.live` and `clk.live` may serve only generated public artifacts; `/healthz`, `/__internal/*`, `/widgets/*`, and other operational Tokyo routes must return 404 there.

## Prague

Project:
- `prague-dev`

Git settings:
- Repo: `CKsangiacomo/clickeen`
- Production branch: `main`
- Root directory: `prague`
- Build command: `pnpm build`
- Output directory: `dist`
- Deploy trigger: Git-connected Cloudflare Pages build only

Public host:
- Canonical host: `https://prague.dev.clickeen.com`
- Required: yes

Env contract:

| Variable | Required | Cloud-dev value | Source-of-truth owner |
| --- | --- | --- | --- |
| `PUBLIC_TOKYO_URL` | yes | `https://tokyo.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_CLK_LIVE_URL` | optional | `https://dev.clk.live` | Cloudflare Pages dashboard |
| `PUBLIC_ROMA_URL` | yes | `https://roma.dev.clickeen.com` | Cloudflare Pages dashboard |

Dashboard action:
- Keep the 3 public base URLs in the Cloudflare Pages dashboard.

## DevStudio

Project:
- Project name: `devstudio`
- Pages fallback host: `devstudio-dev.pages.dev`

Git settings:
- Repo: `CKsangiacomo/clickeen`
- Production branch: `main`
- Root directory: `admin`
- Build command: `pnpm build`
- Output directory: `dist`
- Deploy trigger: Git-connected Cloudflare Pages build only

Public host:
- Canonical host: `https://devstudio.clickeen.com`
- Required: yes
- `*.pages.dev` allowed as public runtime host: no, except if Cloudflare project
  health checks require fallback reachability.

Auth:
- Berlin/Google login is the only auth boundary.
- Cloudflare Access is not the DevStudio auth boundary.
- The signed-in Berlin session must resolve to the normal Clickeen admin account.

Env contract:

| Variable | Required | Cloud-dev value | Source-of-truth owner |
| --- | --- | --- | --- |
| `BERLIN_BASE_URL` | yes | `https://berlin-dev.clickeen.workers.dev` | `admin/wrangler.toml` |
| `DEVSTUDIO_CANONICAL_ORIGIN` | yes | `https://devstudio.clickeen.com` | `admin/wrangler.toml` |
| `DEVSTUDIO_GITHUB_BRANCH` | yes | `main` | `admin/wrangler.toml` |
| `DEVSTUDIO_GITHUB_REPOSITORY` | yes | `CKsangiacomo/clickeen` | `admin/wrangler.toml` |
| `ENV_STAGE` | yes | `cloud-dev` | `admin/wrangler.toml` |
| `DEVSTUDIO_GITHUB_TOKEN` | yes | GitHub contents token scoped to this repo | Cloudflare Pages secret |
| `E2E_AUTH_SECRET` | yes | shared Berlin/Playwright e2e bootstrap secret | Cloudflare Pages secret |

Verification:
- `pnpm cf:pages:devstudio-env` compares live DevStudio Pages env against
  `admin/wrangler.toml` and confirms whether the live-only required Pages
  secrets exist.

Policy API:
- Pages Functions own `/api/entitlements/matrix`, `/api/entitlements/matrix/cell`,
  `/api/ai-runtime/matrix`, and `/api/ai-runtime/matrix/cell`.
- GET reads current `main` through the GitHub contents API.
- POST applies `@clickeen/ck-policy` validators and commits the updated JSON back
  to `main`.

## Tokyo/R2 Git-Authored Asset Roots

These roots are deployed from git-authored repo sources into R2. They are not mutated by account runtime operations.

| Repo source | Canonical R2 root | Notes |
| --- | --- | --- |
| `tokyo/product/dieter/**` | `dieter/**` | Built Dieter manifest, tokens, components, and icons. |
| `tokyo/product/fonts/**` | `fonts/**` | Global Clickeen font CDN media. Account-uploaded fonts stay under `accounts/{accountPublicId}/...`. |
| `tokyo/product/widgets/**` | `product/widgets/**` | Widget software. Friendly `/widgets/**` routes must serve these objects. |
| `tokyo/product/media/**` | `product/media/**` | Product-owned media. |
| `tokyo/product/themes/**` | `product/themes/**` | Product-owned theme media. |
| `tokyo/roma/**` | `product/roma/**` | Product app/static support media. |
| `tokyo/prague/**` | `prague/**` | Prague page/content/GTM media, including page-local translation sidecars. |

Forbidden deploy targets for these git-authored media:
- root `widgets/**`
- root `l10n/**`
- root `public/**`
- root `published/**`

`published/**`, while it may exist during PRD 099 execution, is runtime/public projection state and must not be normalized as a deploy destination for git-authored media.

## Live-Only Secrets And External State

These values remain outside git by design. Keep the inventory true; do not store secret values in repo files.

Worker secrets:
- Berlin: `SUPABASE_SERVICE_ROLE_KEY`
- San Francisco: `AI_GRANT_HMAC_SECRET`

Pages secrets:
- Roma: `AI_GRANT_HMAC_SECRET` is required for account Copilot grant/outcome signing. Roma -> Tokyo/Tokyo-worker product control uses service bindings and account-widget l10n generation runs through Tokyo-worker -> San Francisco `SANFRANCISCO_L10N`.
- DevStudio: `DEVSTUDIO_GITHUB_TOKEN` is required for GitHub-backed policy writes; `E2E_AUTH_SECRET` is required for the dev-only remote Playwright bootstrap.

CI secrets/vars:
- `CLOUDFLARE_API_TOKEN` for GitHub Actions/Wrangler workflows only. Do not reuse
  this ambiguous name for local repo Cloudflare helper commands.
- `CLOUDFLARE_REST_API_TOKEN` for local Pages/DNS/config repo helper commands.
- `CLOUDFLARE_ACCOUNT_ID`
- `AI_GRANT_HMAC_SECRET` for Prague string translation request signing
- No Supabase deploy secrets are required by GitHub Actions. Supabase migrations are applied deliberately from an authenticated operator/agent environment, then committed as schema history.

Rules:
- Bob and Roma host/base-URL vars belong in app-local `wrangler.toml`.
- Bob and Roma Supabase runtime values belong in the Cloudflare dashboard/runtime env, not committed repo literals.
- Roma asset control requires the `TOKYO_ASSET_CONTROL` service binding to target `tokyo-assets-dev`; the asset lane no longer depends on Roma/Tokyo-worker shared-secret parity.
- Roma product control requires the `TOKYO_PRODUCT_CONTROL` service binding to target `tokyo-assets-dev`; Builder open/save/l10n authoring no longer depend on public Tokyo shared-secret HTTP.
- Worker and Pages secrets stay live-only, but any new secret must be documented here with owning service and purpose.
- If a Pages custom domain serves stale runtime after a Git-connected deploy, fix the underlying config or verification gap; do not normalize direct artifact deploys as the operating model.

## PRD 63 Completion Proof

- Bob, Roma, and Prague are Git-connected Pages projects.
- Git build is the active deploy behavior for Bob, Roma, and Prague.
- Bob and Roma non-secret vars are present in `wrangler.toml`, not duplicated in the Cloudflare dashboard.
- Prague runtime vars are present in the Cloudflare dashboard.
- Bob and Roma custom-domain bindings are active on `*.dev.clickeen.com`.
- No GitHub workflow still creates Pages projects, syncs Pages secrets, or deploys Pages artifacts.
- Verified cloud-dev host behavior on 2026-03-10:
  - `https://bob.dev.clickeen.com/bob` returns `200`
  - `https://roma.dev.clickeen.com/home` redirects to login when unauthenticated
  - `https://dev.clk.live/{accountPublicId}/{instanceId}` returns generated static HTML for a known published cloud-dev instance
  - `https://prague.dev.clickeen.com/us/en/` returns `200`
