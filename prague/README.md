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
- `PUBLIC_CLK_LIVE_URL` — optional base URL for static account instance mini-sites (defaults to `https://clk.live`)

Optional:

- `PUBLIC_ROMA_URL` (used by `/{market}/{locale}/create` redirect bridge to Roma `/home`)

Prague widget pages embed explicit Clickeen-owned account instances by `accountInstanceRef.accountPublicId` and `accountInstanceRef.instanceId`. Locale-specific embeds use the same canonical public instance URL with `?locale={locale}`; Prague does not select per-locale generated artifacts, discover widget locale availability, or read translation internals.

Cloudflare (dev):

- `PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com`
- `PUBLIC_CLK_LIVE_URL=https://clk.live`

For isolated local Prague debugging, create `prague/.env.local` with explicit
cloud-dev Tokyo/public-serving values.

Dev:
- `pnpm dev:prague` (serves on `http://localhost:4321`)
  - Example widget route: `http://localhost:4321/us/en/widgets/faq`

Build:
- `pnpm build:prague`

Details:
- `documentation/services/prague/prague-overview.md`
