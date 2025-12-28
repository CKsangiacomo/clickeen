# Paris Worker (dev)

Cloudflare Worker implementation of the minimal Paris API needed by Bob/DevStudio.

## Endpoints

- `GET /api/healthz`
- `GET /api/instances`
- `GET /api/instance/:publicId`
- `PUT /api/instance/:publicId`
  - body supports: `{ config?: object, status?: 'draft'|'published'|'inactive', displayName?: string }`

## Required environment / secrets

- `SUPABASE_URL` (env var)
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `PARIS_DEV_JWT` (secret) — required; must match Bob’s `PARIS_DEV_JWT`

All `/api/*` routes except `/api/healthz` require:

`Authorization: Bearer ${PARIS_DEV_JWT}`

## Deploy

**Cloudflare dashboard (recommended)**
- Workers & Pages → Create application → Worker → Connect GitHub
- Root directory: `paris-worker`
- Deploy command: `npx wrangler deploy`
- Add custom domain: `paris.dev.clickeen.com`

**CLI**
- `pnpm --filter @clickeen/paris-worker exec wrangler deploy`

