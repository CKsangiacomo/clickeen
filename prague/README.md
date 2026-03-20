# Prague

Prague is the marketing + SEO surface (Cloudflare Pages + Astro).

Deploy plane:
- Git-connected Cloudflare Pages build only
- root: `prague/`
- build command: `pnpm build`
- output: `dist`
- Canonical cloud-dev host: `https://prague.dev.clickeen.com`
- GitHub Actions may verify Prague builds and publish Prague content to Tokyo/R2, but must not create Pages projects, sync Pages secrets, or deploy Prague artifacts.

Status in this repo: active runtime.

Canonical routes in this repo snapshot:
- `/{market}/{locale}/`
- `/{market}/{locale}/create`
- `/{market}/{locale}/widgets/{widget}`
- `/{market}/{locale}/widgets/{widget}/{page}`
- `/{market}/{locale}/privacy`

## Env

Prague is strict: these env vars are required at build/runtime (because they are used in `*.astro`):

- `PUBLIC_TOKYO_URL` — base URL for Tokyo assets (Dieter + widget specs + i18n)
- `PUBLIC_VENICE_URL` — base URL for Venice embed runtime (used for curated instance iframes)

Optional:

- `PUBLIC_PRAGUE_BUILD_ID` (optional override for Prague l10n cache token; defaults to `CF_PAGES_COMMIT_SHA` automatically)
- `PUBLIC_ROMA_URL` (used by `/{market}/{locale}/create` redirect bridge to Roma `/home`)

Prague widget demo `publicId` is derived from the widget slug as `wgt_main_${widget}` and is not overridden.

Local defaults (when running `scripts/dev-up.sh`):

- `PUBLIC_TOKYO_URL=http://localhost:4000`
- `PUBLIC_VENICE_URL=http://localhost:3003`

Cloudflare (dev):

- `PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com`
- `PUBLIC_VENICE_URL=https://venice.dev.clickeen.com` (must serve `GET /e/:publicId`)

If you're not using `scripts/dev-up.sh`, create `prague/.env.local` with the values you want.

Dev:
- `pnpm dev:prague` (serves on `http://localhost:4321`)
  - Example widget route: `http://localhost:4321/us/en/widgets/faq`

Build:
- `pnpm build:prague`

Details:
- `documentation/services/prague/prague-overview.md`
