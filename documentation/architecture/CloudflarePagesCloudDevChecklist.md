# Cloudflare Pages Cloud-Dev Checklist

Status: FINAL STATE AFTER PRD 063  
Owner: Human architect for dashboard alignment; repo/runtime owners for app-local build contracts

This checklist is the canonical manual setup contract for Cloudflare Pages `cloud-dev`.

Rules:
- Cloudflare Pages Git build is the deploy plane for Bob, Roma, Venice, and Prague.
- GitHub Actions must not create Pages projects or sync Pages secrets.
- Each app builds from its own root and writes only to its own output directory.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts for authenticated Builder flows. `*.pages.dev` is not a valid public runtime host for those apps.
- Bob and Roma keep host/base-URL runtime vars in app-local `wrangler.toml`. Supabase project values are live environment config, not committed repo literals.
- Bob and Roma `wrangler.toml` files must stay within the Pages-supported schema. Worker-only blocks such as top-level `observability` or named environments like `local` are not valid Pages config.
- Venice and Prague keep runtime vars in the Cloudflare Pages dashboard because they do not use app-local Wrangler config today.
- DevStudio is local-only and is not part of the Cloudflare Pages `cloud-dev` contract.

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
| `NEXT_PUBLIC_VENICE_URL` | yes | `https://venice.dev.clickeen.com` | `bob/wrangler.toml` |
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

## Venice

Project:
- `venice-dev`

Git settings:
- Repo: `CKsangiacomo/clickeen`
- Production branch: `main`
- Root directory: `venice`
- Build command: `pnpm build:cf`
- Output directory: `.vercel/output/static`
- Deploy trigger: Git-connected Cloudflare Pages build only

Public host:
- Canonical host: `https://venice.dev.clickeen.com`
- Required: yes

Env contract:

| Variable | Required | Cloud-dev value | Source-of-truth owner |
| --- | --- | --- | --- |
| `TOKYO_URL` | yes | `https://tokyo.dev.clickeen.com` | Cloudflare Pages dashboard |

Dashboard action:
- Keep this runtime var in the Cloudflare Pages dashboard.

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
| `PUBLIC_VENICE_URL` | yes | `https://venice.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_ROMA_URL` | yes | `https://roma.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_PRAGUE_BUILD_ID` | no | leave unset (Cloudflare provides `CF_PAGES_COMMIT_SHA`) | Cloudflare Pages runtime |

Dashboard action:
- Keep the 3 public base URLs in the Cloudflare Pages dashboard.
- Leave `PUBLIC_PRAGUE_BUILD_ID` unset unless there is a deliberate override reason.

## Live-Only Secrets And External State

These values remain outside git by design. Keep the inventory true; do not store secret values in repo files.

Worker secrets:
- Berlin: `SUPABASE_SERVICE_ROLE_KEY`, `CK_INTERNAL_SERVICE_JWT`
- Tokyo-worker: `CK_INTERNAL_SERVICE_JWT`
- San Francisco: `AI_GRANT_HMAC_SECRET`, `CK_INTERNAL_SERVICE_JWT`

Pages secrets:
- Roma: `CK_INTERNAL_SERVICE_JWT` (San Francisco only; Roma -> Tokyo/Tokyo-worker product control now uses service bindings)

CI secrets/vars:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD_CLOUD_DEV`
- `SUPABASE_PROJECT_REF_CLOUD_DEV`
- `CLOUD_DEV_SMOKE_EMAIL`
- `CLOUD_DEV_SMOKE_PASSWORD`

Rules:
- Bob and Roma host/base-URL vars belong in app-local `wrangler.toml`.
- Bob and Roma Supabase project values belong in dashboard/runtime env and matching CI env, not committed repo literals.
- Roma asset control requires the `TOKYO_ASSET_CONTROL` service binding to target `tokyo-assets-dev`; the asset lane no longer depends on Roma/Tokyo-worker shared-secret parity.
- Roma product control requires the `TOKYO_PRODUCT_CONTROL` service binding to target `tokyo-assets-dev`; Builder open/save/l10n authoring no longer depend on public Tokyo shared-secret HTTP.
- Worker and Pages secrets stay live-only, but any new secret must be documented here with owning service and purpose.
- If a Pages custom domain serves stale runtime after a Git-connected deploy, fix the underlying config or verification gap; do not normalize direct artifact deploys as the operating model.

## PRD 63 Completion Proof

- Bob, Roma, Venice, and Prague are Git-connected Pages projects.
- Git build is the active deploy behavior for Bob, Roma, Venice, and Prague.
- Bob and Roma non-secret vars are present in `wrangler.toml`, not duplicated in the Cloudflare dashboard.
- Venice and Prague runtime vars are present in the Cloudflare dashboard.
- Bob and Roma custom-domain bindings are active on `*.dev.clickeen.com`.
- No GitHub workflow still creates Pages projects, syncs Pages secrets, or deploys Pages artifacts.
- Verified cloud-dev host behavior on 2026-03-10:
  - `https://bob.dev.clickeen.com/bob` returns `200`
  - `https://roma.dev.clickeen.com/home` redirects to login when unauthenticated
  - `https://venice.dev.clickeen.com/embed/latest/loader.js` returns `200`
  - `https://prague.dev.clickeen.com/us/en/` returns `200`
