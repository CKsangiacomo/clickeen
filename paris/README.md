# Paris

Cloudflare Worker API service.

This README is a quick operational guide. For the full endpoint and behavior contract, see:

- `documentation/services/paris.md`

## Endpoints

Core shipped endpoints in this repo snapshot include:

- `GET /api/healthz`
- `GET /api/instance/:publicId`

Asset route note:

- Asset upload/list/delete are now served via Tokyo-facing routes in Roma/Bob; Paris no longer exposes account asset CRUD endpoints.
- Account locale writes, localization reads, l10n status, and save/publish aftermath are Roma/Berlin/Tokyo-owned; Paris is no longer on that path.

## Curated vs user instances

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances` (local-only writes, widget_type validated against Tokyo).
- `wgt_*_u_*` → `widget_instances` (account-owned, RLS-enforced).

## Auth

Public in this repo snapshot:

- `GET /api/healthz`
- `GET /api/instance/:publicId` (published-only for user-owned instances)

Paris no longer exposes non-public account-mode product endpoints.

## Required secrets/env

- `SUPABASE_URL` (env var)
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `TOKYO_BASE_URL` (env var)
- `TOKYO_DEV_JWT` (secret)

## Local dev

`pnpm dev:paris`

## Deploy

`pnpm --filter @clickeen/paris deploy`
