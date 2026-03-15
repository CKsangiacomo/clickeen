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
- Account locale writes plus account-mode l10n reads are Roma/Berlin/Tokyo-owned; Paris only exposes the internal locale aftermath endpoint for Berlin-triggered orchestration.

## Curated vs user instances

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances` (local-only writes, widget_type validated against Tokyo).
- `wgt_*_u_*` → `widget_instances` (account-owned, RLS-enforced).

## Auth

Public in this repo snapshot:

- `GET /api/healthz`
- `GET /api/instance/:publicId` (published-only for user-owned instances)

Non-public product endpoints require:

- `Authorization: Bearer <Berlin access token>`

Machine/internal endpoints can also use signature-based verification (for example metering and l10n job reporting).

## Required secrets/env

- `SUPABASE_URL` (env var)
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `BERLIN_BASE_URL` (env var)
- `BERLIN_ISSUER` (env var; must match Berlin-issued token `iss`)
- `BERLIN_AUDIENCE` (env var; must match Berlin-issued token `aud`)
- `AI_GRANT_HMAC_SECRET` (secret, AI grants/outcomes)
- `PARIS_DEV_JWT` (secret, internal service-to-service paths only; not accepted for product auth)

## Local dev

`pnpm dev:paris`

## Deploy

`pnpm --filter @clickeen/paris deploy`
