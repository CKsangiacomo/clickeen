# Cloudflare Pages Cloud-Dev Checklist

Status: FINAL STATE AFTER PRD 063  
Owner: Human architect for dashboard alignment; repo/runtime owners for app-local build contracts

This checklist is the canonical manual setup contract for Cloudflare Pages `cloud-dev`.

Rules:
- Cloudflare Pages Git build is the only deploy plane for Pages apps.
- GitHub Actions must not create Pages projects, sync Pages secrets, or deploy Pages artifacts.
- Each app builds from its own root and writes only to its own output directory.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts for authenticated Builder flows. `*.pages.dev` is not a valid public runtime host for those apps.
- Bob and Roma keep non-secret runtime vars in app-local `wrangler.toml`. Do not duplicate those vars in the Cloudflare dashboard.
- Venice and Prague keep runtime vars in the Cloudflare Pages dashboard because they do not use app-local Wrangler config today.

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
| `PARIS_BASE_URL` | yes | `https://paris.dev.clickeen.com` | `bob/wrangler.toml` |
| `BERLIN_BASE_URL` | yes | `https://berlin-dev.clickeen.workers.dev` | `bob/wrangler.toml` |
| `SANFRANCISCO_BASE_URL` | yes | `https://sanfrancisco.dev.clickeen.com` | `bob/wrangler.toml` |

Dashboard action:
- Do not add these non-secret vars in the Cloudflare dashboard.
- Final settled state: Bob non-secret runtime vars live only in `bob/wrangler.toml`.

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
| `PARIS_BASE_URL` | yes | `https://paris.dev.clickeen.com` | `roma/wrangler.toml` |
| `NEXT_PUBLIC_TOKYO_URL` | yes | `https://tokyo.dev.clickeen.com` | `roma/wrangler.toml` |
| `BERLIN_BASE_URL` | yes | `https://berlin-dev.clickeen.workers.dev` | `roma/wrangler.toml` |
| `NEXT_PUBLIC_BOB_URL` | yes | `https://bob.dev.clickeen.com` | `roma/wrangler.toml` |

Dashboard action:
- Do not add these non-secret vars in the Cloudflare dashboard.
- Final settled state: Roma non-secret runtime vars live only in `roma/wrangler.toml`.

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
| `PUBLIC_BOB_URL` | yes | `https://bob.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_VENICE_URL` | yes | `https://venice.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_PARIS_URL` | yes | `https://paris.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_ROMA_URL` | yes | `https://roma.dev.clickeen.com` | Cloudflare Pages dashboard |
| `PUBLIC_PRAGUE_BUILD_ID` | no | leave unset (Cloudflare provides `CF_PAGES_COMMIT_SHA`) | Cloudflare Pages runtime |

Dashboard action:
- Keep the 5 public base URLs in the Cloudflare Pages dashboard.
- Leave `PUBLIC_PRAGUE_BUILD_ID` unset unless there is a deliberate override reason.

## PRD 63 Completion Proof

- Bob, Roma, Venice, and Prague are Git-connected Pages projects.
- Git build is the only active deploy behavior for each project.
- Bob and Roma non-secret vars are present in `wrangler.toml`, not duplicated in the Cloudflare dashboard.
- Venice and Prague runtime vars are present in the Cloudflare dashboard.
- Bob and Roma custom-domain bindings are active on `*.dev.clickeen.com`.
- No GitHub workflow still creates Pages projects, syncs Pages secrets, or deploys Pages artifacts.
- Verified cloud-dev host behavior on 2026-03-10:
  - `https://bob.dev.clickeen.com/bob` returns `200`
  - `https://roma.dev.clickeen.com/home` redirects to login when unauthenticated
  - `https://venice.dev.clickeen.com/embed/latest/loader.js` returns `200`
  - `https://prague.dev.clickeen.com/us/en/` returns `200`
