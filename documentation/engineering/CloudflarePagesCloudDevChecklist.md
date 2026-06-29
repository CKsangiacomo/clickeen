# Cloudflare Pages Cloud-Dev Checklist

STATUS: CURRENT SYSTEM OPERATOR SPEC

This checklist is the current manual setup contract for Cloudflare Pages
`cloud-dev`. It documents live Pages project requirements, app-local build
contracts, custom domains, required env vars, service bindings, and live-only
secrets.

Rules:
- Cloudflare Pages Git build is the deploy plane for Bob, Roma, and Prague.
- Tokyo/R2 git-authored deploy roots are `dieter/`, `product/`, and `prague/`; only `accounts/` is runtime-managed account storage.
- Tokyo-worker/R2 is the source/deploy and friendly-serving boundary for
  Tokyo-owned static product roots. It must not become a second authority for
  product widget software, Dieter media, product media, or Prague
  content.
- Widget software is served from canonical R2 `product/widgets/**`. Friendly `/widgets/**` routes must resolve there.
- Prague page translations deploy beside page JSON under `prague/pages/{widget}/{page}.translations/{locale}.json`.
- GitHub Actions must not create Pages projects or sync Pages secrets.
- Each app builds from its own root and writes only to its own output directory.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts for authenticated Builder flows. `*.pages.dev` is not a valid public runtime host for those apps.
- Bob and Roma keep host/base-URL runtime vars in app-local `wrangler.toml`. Supabase project values are live environment config, not committed repo literals.
- Bob and Roma `wrangler.toml` files must stay within the Pages-supported schema. Worker-only blocks such as top-level `observability` or named environments like `local` are not valid Pages config.
- Prague keeps runtime vars in the Cloudflare Pages dashboard.
- DevStudio is the canonical internal Pages toolbench at `https://devstudio.clickeen.com`.
- GitHub runtime verification stays unauthenticated unless cloud-dev admin auth secrets are available to the runner; do not keep public auth bypasses for smoke coverage.
- Authenticated cloud-dev E2E uses Berlin's dev-admin provider to mint a normal
  session for the existing `CLICKEEN` account. The exact coverage is owned by
  `documentation/engineering/PlaywrightE2E.md` and the current `e2e/**` specs.
- Berlin/Roma product auth, bootstrap, Builder, account registry, Tokyo, and Tokyo-worker account-control paths must not require shared-secret bearer auth. Internal San Francisco tooling requests use signed request bodies.

## AI Operator Quick Start

Start every Pages/config task with read-only evidence:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project bob-dev
pnpm cf:pages:project roma-dev
pnpm cf:pages:project prague-dev
pnpm cf:pages:project devstudio
```

For custom domains:

```bash
pnpm cf:pages:domains bob-dev
pnpm cf:pages:domains roma-dev
pnpm cf:pages:domains prague-dev
pnpm cf:pages:domains devstudio
```

For DevStudio env/project drift:

```bash
pnpm cf:pages:devstudio-env
pnpm cf:pages:sync-devstudio-env
pnpm cf:pages:sync-devstudio-project
```

Only add `--apply` after the dry-run output is the intended mutation.

If `pnpm cf:api:preflight` fails, stop. Do not use dashboard screenshots,
guessed Pages state, direct artifact deploys, or a public auth bypass as
replacement evidence.

## Authority Map

| Concern | Authority | Evidence |
| --- | --- | --- |
| Bob Pages project config | Cloudflare Pages project `bob-dev` | `pnpm cf:pages:project bob-dev` |
| Roma Pages project config | Cloudflare Pages project `roma-dev` | `pnpm cf:pages:project roma-dev` |
| Prague Pages project config | Cloudflare Pages project `prague-dev` | `pnpm cf:pages:project prague-dev` |
| DevStudio Pages project config | Cloudflare Pages project `devstudio` | `pnpm cf:pages:project devstudio` |
| Bob/Roma host/base URL vars | app-local `wrangler.toml` | repo diff plus Pages project build/runtime evidence |
| Prague runtime vars | Cloudflare Pages dashboard/runtime env | Cloudflare Pages project/env evidence |
| Roma Supabase values/secrets | Cloudflare Pages dashboard/runtime env | Cloudflare Pages project/env evidence |
| Roma service bindings/KV | Cloudflare Pages dashboard/project config | Cloudflare Pages project evidence |
| DevStudio env/project sync | repo Cloudflare API helper | dry-run, `--apply`, read-back |
| Custom domains | Cloudflare Pages domains + DNS | `pnpm cf:pages:domains`, `pnpm cf:dns:records` |
| Public embed route | Tokyo-worker zone route | `https://dev.clk.live/{accountPublicId}/{instanceId}` plus route-boundary checks |
| Git-authored R2 product roots | Tokyo/R2 product-root sync | `pnpm tokyo:r2:sync:*` plus exact R2 key evidence |

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

Dashboard action:
- Keep `NEXT_PUBLIC_TOKYO_URL` in `bob/wrangler.toml`.
- Runtime flags: `nodejs_compat`, `nodejs_compat_populate_process_env`

Operator checks:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project bob-dev
pnpm cf:pages:domains bob-dev
```

Pass criteria:

- project root directory is `bob`;
- production branch is `main`;
- build command is `pnpm build:cf`;
- output directory is `.cloudflare/output/static`;
- custom domain includes `bob.dev.clickeen.com`;
- runtime responds at `https://bob.dev.clickeen.com/bob`.

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
| `NEXT_PUBLIC_CLK_LIVE_URL` | yes | `https://dev.clk.live` | `roma/wrangler.toml` |
| `BERLIN_BASE_URL` | yes | `https://berlin-dev.clickeen.workers.dev` | `roma/wrangler.toml` |
| `PRODUCT_COPILOT_BASE_URL` | yes | `https://product-copilot-dev.clickeen.workers.dev` | `roma/wrangler.toml` |
| `SANFRANCISCO_BASE_URL` | yes | `https://sanfrancisco.dev.clickeen.com` | `roma/wrangler.toml` |
| `NEXT_PUBLIC_BOB_URL` | yes | `https://bob.dev.clickeen.com` | `roma/wrangler.toml` |
| `SUPABASE_URL` | yes | `https://ebmqwqdexmemhrdhkmwn.supabase.co` | Cloudflare Pages dashboard + GitHub Actions env |
| `SUPABASE_ANON_KEY` | yes | cloud-dev anon key for project `ebmqwqdexmemhrdhkmwn` | Cloudflare Pages dashboard + GitHub Actions env |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | cloud-dev service-role key for account settings writes | Cloudflare Pages secret |

Dashboard action:
- Keep `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the Cloudflare Pages dashboard for the live Roma app.
- Keep `AI_GRANT_HMAC_SECRET` as a Roma Pages secret for Copilot grant/outcome signing and Translation Agent grant minting.
- Keep the host/base-URL vars in `roma/wrangler.toml`.
- Configure the `TOKYO_ASSET_CONTROL` service binding on Roma Pages to target the `tokyo-assets-dev` worker.
- Configure the `TOKYO_PRODUCT_CONTROL` service binding on Roma Pages to target the `tokyo-assets-dev` worker.
- Configure the `TRANSLATION_AGENT` service binding on Roma Pages to target the `translation-agent-dev` worker.
- Configure `USAGE_KV` on Roma Pages with the namespace ids in `roma/wrangler.toml`.
- Runtime flags: `nodejs_compat`, `nodejs_compat_populate_process_env`

Runtime host note:
- Roma runtime truth is `BERLIN_BASE_URL=https://berlin-dev.clickeen.workers.dev` from `roma/wrangler.toml`.
- GitHub Actions may inject `BERLIN_BASE_URL=https://berlin.dev.clickeen.com` for build/verify jobs. That is CI input, not the committed Roma Pages runtime contract.

Operator checks:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project roma-dev
pnpm cf:pages:domains roma-dev
```

Pass criteria:

- project root directory is `roma`;
- production branch is `main`;
- build command is `pnpm build:cf`;
- output directory is `.vercel/output/static`;
- custom domain includes `roma.dev.clickeen.com`;
- runtime responds at `https://roma.dev.clickeen.com/home`;
- live env/secrets include the three Supabase values listed above;
- service bindings include `TOKYO_ASSET_CONTROL`, `TOKYO_PRODUCT_CONTROL`, and
  `TRANSLATION_AGENT`;
- KV bindings include `USAGE_KV`.

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

Operator checks:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project prague-dev
pnpm cf:pages:domains prague-dev
```

Pass criteria:

- project root directory is `prague`;
- production branch is `main`;
- build command is `pnpm build`;
- output directory is `dist`;
- custom domain includes `prague.dev.clickeen.com`;
- runtime responds at `https://prague.dev.clickeen.com/us/en/`;
- live runtime env includes the required public base URLs listed above.

## DevStudio

Project:
- Project name: `devstudio`
- Pages platform-default host: `devstudio-dev.pages.dev`

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
- `*.pages.dev` allowed as public runtime host: no, except when Cloudflare
  project health checks require platform-default host reachability.

Auth:
- Berlin is the auth boundary. Google is the normal human login provider; the
  Berlin dev-admin provider exists only for cloud-dev authenticated e2e.
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

Verification:
- `pnpm cf:pages:devstudio-env` compares live DevStudio Pages env against
  `admin/wrangler.toml` and confirms whether the live-only required Pages
  secrets exist.

Operator commands:

```bash
pnpm cf:api:preflight
pnpm cf:pages:devstudio-env
pnpm cf:pages:sync-devstudio-env
pnpm cf:pages:sync-devstudio-env --apply
pnpm cf:pages:sync-devstudio-project
pnpm cf:pages:sync-devstudio-project --apply
pnpm cf:pages:put-secret devstudio DEVSTUDIO_GITHUB_TOKEN --apply
pnpm cf:pages:domains devstudio
pnpm cf:dns:records clickeen.com devstudio.clickeen.com
```

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
| `tokyo/product/widgets/**` | `product/widgets/**` | Widget software. Friendly `/widgets/**` routes must serve these objects. |
| `tokyo/roma/**` | `product/roma/**` | Product app/static support media. |
| `tokyo/prague/**` | `prague/**` | Prague page/content/GTM media, including page-local translation sidecars. |

Do not add deploy targets outside the current source-to-R2 roots above unless a
new product law explicitly creates that root and its owning operation path.

Prague R2 sync note:
- `tokyo/prague/**` is supported by `pnpm tokyo:r2:sync:check` and `pnpm tokyo:r2:sync:remote`.
- Current `cloud-dev workers deploy` R2 sync trigger does not automatically run for `tokyo/prague/**` changes.
- Current `cloud-dev prague content release` validates/builds Prague content and does not sync `tokyo/prague/**` to R2.
- If Prague R2 content must be updated before the workflow trigger includes it,
  run the Tokyo product-root sync path deliberately and verify exact `prague/**`
  keys in R2.

## Live-Only Secrets And External State

These values remain outside git by design. Keep the inventory true; do not store secret values in repo files.

Worker secrets:
- Berlin: `SUPABASE_SERVICE_ROLE_KEY`, `BERLIN_DEV_ADMIN_EMAIL`, `BERLIN_DEV_ADMIN_PASSWORD`
- San Francisco: `AI_GRANT_HMAC_SECRET`
- Translation Agent: `AI_GRANT_HMAC_SECRET`
- Tokyo-worker: `AI_GRANT_HMAC_SECRET` for Translation Agent overlay write grant verification
- Tokyo-worker: `CLOUDFLARE_API_TOKEN` for exact public `clk.live` cache
  purge after published package byte writes/deletes. Cloud-dev deploys this as a
  Worker secret from the GitHub Actions `CLOUDFLARE_API_TOKEN` secret.

Pages secrets:
- Roma: `AI_GRANT_HMAC_SECRET` is required for account Copilot grant/outcome signing and Translation Agent grant minting. `SUPABASE_SERVICE_ROLE_KEY` is required for Roma-owned account settings writes. Roma -> Tokyo/Tokyo-worker storage commands use service bindings. Account instance translation generation calls the Translation Agent Worker; that Worker calls San Francisco `/model/chat` and writes translated locale values via Tokyo-worker.
- DevStudio: `DEVSTUDIO_GITHUB_TOKEN` is required for GitHub-backed policy writes.

CI secrets/vars:
- `CLOUDFLARE_API_TOKEN` for GitHub Actions/Wrangler workflows and the
  Tokyo-worker runtime public-cache purge secret installed by the
  `cloud-dev workers deploy` workflow. This cloud-dev token must include Worker
  deploy and public zone cache-purge authority. Do not reuse this ambiguous name
  for local repo Cloudflare helper commands.
- `CLOUDFLARE_REST_API_TOKEN` for local Pages/DNS/config repo helper commands.
- `CLOUDFLARE_ACCOUNT_ID`
- `AI_GRANT_HMAC_SECRET` for Prague string translation request signing
- Supabase migration workflow: `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DB_PASSWORD`, and `SUPABASE_URL_CLOUD_DEV`. Supabase schema changes
  deploy through the reviewed migration workflow, not through Pages or Worker
  deploys. See `documentation/engineering/SupabaseOperations.md`.

Rules:
- Bob and Roma host/base-URL vars belong in app-local `wrangler.toml`.
- Bob and Roma Supabase runtime values belong in the Cloudflare dashboard/runtime env, not committed repo literals.
- Roma asset control requires the `TOKYO_ASSET_CONTROL` service binding to target `tokyo-assets-dev`.
- Roma uses the `TOKYO_PRODUCT_CONTROL` service binding for Tokyo storage commands targeting `tokyo-assets-dev`.
- Roma uses the `TRANSLATION_AGENT` service binding for account instance translation generation.
- Worker and Pages secrets stay live-only, but any new secret must be documented here with owning service and purpose.
- If a Pages custom domain serves a previous deploy after a Git-connected deploy,
  fix the underlying config or verification gap; do not normalize direct
  artifact deploys as the operating model.

## Verification

Run verification from the owning surface:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project bob-dev
pnpm cf:pages:project roma-dev
pnpm cf:pages:project prague-dev
pnpm cf:pages:project devstudio
pnpm cf:pages:domains bob-dev
pnpm cf:pages:domains roma-dev
pnpm cf:pages:domains prague-dev
pnpm cf:pages:domains devstudio
pnpm cf:pages:devstudio-env
pnpm cf:dns:records clickeen.com devstudio.clickeen.com
```

Runtime URLs:

```text
https://bob.dev.clickeen.com/bob
https://roma.dev.clickeen.com/home
https://dev.clk.live/{accountPublicId}/{instanceId}
https://prague.dev.clickeen.com/us/en/
https://devstudio.clickeen.com
```

Pass criteria:

- Bob, Roma, Prague, and DevStudio are Git-connected Pages projects.
- Git build is the active deploy behavior for Bob, Roma, Prague, and DevStudio.
- Bob and Roma non-secret vars are present in app-local `wrangler.toml`.
- Roma Supabase env/secrets are live-only Cloudflare Pages config.
- Prague runtime vars are live-only Cloudflare Pages config.
- Bob and Roma custom-domain bindings are active on `*.dev.clickeen.com`.
- DevStudio custom-domain binding is active on `devstudio.clickeen.com`.
- No GitHub workflow creates Pages projects, syncs Pages secrets, or deploys
  Pages artifacts for these apps.

Hard stops:

- failed `pnpm cf:api:preflight`;
- project is not Git-connected to `CKsangiacomo/clickeen` on `main`;
- custom domain missing or pointing at the wrong Pages project;
- Pages env mismatch for a required variable/secret;
- Roma service binding or KV binding missing;
- direct Pages artifact deploy proposed as a replacement for Git-connected
  deploys;
- authenticated cloud-dev verification attempted through public auth bypasses.
