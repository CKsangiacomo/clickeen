# Venice

Venice is the active embed runtime (Next.js Edge; deployed on Cloudflare Pages).

Key routes (shipped):
- `GET /e/:publicId` (SSR embed HTML)
- `GET /r/:publicId` (render JSON; `?meta=1` for SEO/GEO metadata payload)
- `GET /widgets/*` and `GET /dieter/*` (Tokyo asset proxy)
- `GET /embed/latest/loader.js` and `GET /embed/v2/loader.js` (embed loader)
- `GET /embed/pixel` (best-effort usage meter forwarding)
- `POST /s/:publicId` (submission proxy to Paris)

Required env (deployed environments):
- `PARIS_URL` (or `NEXT_PUBLIC_PARIS_URL`)
- `TOKYO_URL` (or `TOKYO_BASE_URL` / `NEXT_PUBLIC_TOKYO_URL`)

Optional:
- `USAGE_EVENT_HMAC_SECRET` (required only for signed usage forwarding in `/embed/pixel`)
- `VENICE_INTERNAL_BYPASS_TOKEN` (required outside local for controlled `x-ck-snapshot-bypass: 1` preview/debug path)

Local dev:
- `pnpm dev:venice` (default `http://localhost:3003`)

Build/deploy:
- `pnpm --filter @clickeen/venice build`
- `pnpm --filter @clickeen/venice build:cf`

Details:
- `documentation/services/venice.md`
