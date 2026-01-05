# Prague

Prague is the marketing + SEO surface (Cloudflare Pages + Astro).

Status in this repo: scaffolded, first page only.

## Env

Prague is strict: these env vars are required at build/runtime (because they are used in `*.astro`):

- `PUBLIC_TOKYO_URL` — base URL for Tokyo assets (Dieter + widget specs + i18n)
- `PUBLIC_BOB_URL` — base URL for Bob (used by the MiniBob iframe embed)

Local defaults (when running `scripts/dev-up.sh`):

- `PUBLIC_TOKYO_URL=http://localhost:4000`
- `PUBLIC_BOB_URL=http://localhost:3000`

Cloudflare (dev):

- `PUBLIC_TOKYO_URL=https://tokyo-dev.pages.dev`
- `PUBLIC_BOB_URL=https://bob-dev.pages.dev`

If you're not using `scripts/dev-up.sh`, create `prague/.env.local` with the values you want.

Dev:
- `pnpm dev:prague` (serves on `http://localhost:4321`)
  - Playground: `http://localhost:4321/en/playground/carousel`
  - Playground (landing template): `http://localhost:4321/en/playground/landing`

Build:
- `pnpm build:prague`
