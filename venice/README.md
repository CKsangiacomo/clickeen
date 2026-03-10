# Venice

Venice is the active embed runtime (Next.js Edge; deployed on Cloudflare Pages).

Deploy plane:
- Git-connected Cloudflare Pages build only
- root: `venice/`
- build command: `pnpm build:cf`
- output: `.vercel/output/static`
- GitHub Actions may verify the build contract, but must not create Pages projects, sync Pages secrets, or deploy Venice artifacts.

Key routes (shipped):
- `GET /e/:publicId` (SSR embed HTML)
- `GET /r/:publicId` (render JSON; `?meta=1` for SEO/GEO metadata payload)
- `GET /widgets/*` and `GET /dieter/*` (Tokyo asset proxy)
- `GET /embed/latest/loader.js` and `GET /embed/v2/loader.js` (embed loader)
- `GET /embed/pixel` (compat no-op `204`)

Required env (deployed environments):
- `TOKYO_URL` (or `TOKYO_BASE_URL` / `NEXT_PUBLIC_TOKYO_URL`)

Optional:
- `VENICE_INTERNAL_BYPASS_TOKEN` (required outside local for tokyo-worker access to internal snapshot-source routes)

Local dev:
- `pnpm dev:venice` (default `http://localhost:3003`)

Build/deploy:
- `pnpm --filter @clickeen/venice build`
- `pnpm --filter @clickeen/venice build:cf`

Details:
- `documentation/services/venice.md`
