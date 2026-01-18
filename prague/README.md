# Prague

Prague is the marketing + SEO surface (Cloudflare Pages + Astro).

Status in this repo: scaffolded, first page only.

## Env

Prague is strict: these env vars are required at build/runtime (because they are used in `*.astro`):

- `PUBLIC_TOKYO_URL` — base URL for Tokyo assets (Dieter + widget specs + i18n)
- `PUBLIC_BOB_URL` — base URL for Bob (used by the MiniBob iframe embed)
- `PUBLIC_VENICE_URL` — base URL for Venice embed runtime (used for curated instance iframes)

Optional (to pin the Minibob workspace only):

- `PUBLIC_MINIBOB_WORKSPACE_ID_<WIDGET>` or `PUBLIC_MINIBOB_WORKSPACE_ID` (fallback)

Minibob `publicId` is derived from the widget slug as `wgt_main_${widget}` and is not overridden.

Local defaults (when running `scripts/dev-up.sh`):

- `PUBLIC_TOKYO_URL=http://localhost:4000`
- `PUBLIC_BOB_URL=http://localhost:3000`
- `PUBLIC_VENICE_URL=http://localhost:3003`

Cloudflare (dev):

- `PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com`
- `PUBLIC_BOB_URL=https://bob.dev.clickeen.com`
- `PUBLIC_VENICE_URL=https://venice.dev.clickeen.com` (must serve `GET /e/:publicId`)

If you're not using `scripts/dev-up.sh`, create `prague/.env.local` with the values you want.

Dev:
- `pnpm dev:prague` (serves on `http://localhost:4321`)
  - Playground: `http://localhost:4321/en/playground/carousel`
  - Playground (landing template): `http://localhost:4321/en/playground/landing`

Build:
- `pnpm build:prague`
