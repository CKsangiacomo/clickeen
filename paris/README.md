# Paris

Cloudflare Worker API service (dev).

## Endpoints

- `GET /api/healthz`
- `GET /api/instances`
- `GET /api/curated-instances`
- `GET /api/workspaces/:workspaceId/instances`
- `POST /api/workspaces/:workspaceId/instances`
- `GET /api/workspaces/:workspaceId/instance/:publicId`
- `PUT /api/workspaces/:workspaceId/instance/:publicId`
- `GET /api/instance/:publicId`
- `PUT /api/instance/:publicId`
  - body supports: `{ config?: object, status?: 'published'|'unpublished' }`

## Curated vs user instances

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances` (local-only writes, widget_type validated against Tokyo).
- `wgt_*_u_*` → `widget_instances` (workspace-owned, RLS-enforced).

## Auth (dev)

Everything except `/api/healthz` requires:

`Authorization: Bearer ${PARIS_DEV_JWT}`

## Required secrets/env

- `SUPABASE_URL` (env var)
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `PARIS_DEV_JWT` (secret)

## Local dev

`pnpm dev:paris`

## Deploy

`pnpm --filter @clickeen/paris deploy`
