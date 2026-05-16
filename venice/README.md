# Venice

Venice is the active embed runtime (Next.js Edge; deployed on Cloudflare Pages).

Deploy plane:
- Git-connected Cloudflare Pages build only
- root: `venice/`
- build command: `pnpm build:cf`
- output: `.vercel/output/static`
- GitHub Actions may verify the build contract, but must not create Pages projects, sync Pages secrets, or deploy Venice artifacts.

Key routes (shipped):
- `GET /widget/:accountPublicId/:instanceId` (SSR embed HTML)
- `GET /widgets/*` and `GET /dieter/*` (Tokyo asset proxy)
- `GET /embed/latest/loader.js` and `GET /embed/v2/loader.js` (embed loader)
- `GET /renders/accounts/:accountPublicId/instances/:instanceId/live/r.json`, `/config.json`, `/overlays/:overlayId.json`, and SEO/GEO meta pack routes (Tokyo published render proxies)

Venice is a public PBX: it proxies account-scoped published projections that already exist, and otherwise returns a miss. Publish, unpublish, commercial policy, lifecycle, eligibility, and account-operation decisions belong to Roma/account ops before the projection reaches Tokyo.

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
