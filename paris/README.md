# Paris

Cloudflare Worker API service (dev).

## Endpoints

- `GET /api/healthz`
- `GET /api/instances`
- `GET /api/instance/:publicId`
- `PUT /api/instance/:publicId`
  - body supports: `{ config?: object, status?: 'draft'|'published'|'inactive', displayName?: string }`

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
