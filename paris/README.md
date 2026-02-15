# Paris

Cloudflare Worker API service.

This README is a quick operational guide. For the full endpoint and behavior contract, see:
- `documentation/services/paris.md`

## Endpoints

Core shipped endpoints in this repo snapshot include:
- `GET /api/healthz`
- `GET /api/me`
- `POST /api/accounts` (Supabase session + `Idempotency-Key`)
- `GET /api/instances`
- `GET /api/curated-instances`
  - optional query: `includeConfig=0|1` (default `1`; set `0` for lightweight list responses without `config`)
- `GET /api/workspaces/:workspaceId/instances`
- `POST /api/workspaces/:workspaceId/instances`
- `GET /api/workspaces/:workspaceId/instance/:publicId`
- `PUT /api/workspaces/:workspaceId/instance/:publicId`
- `GET /api/instance/:publicId`
- `PUT /api/instance/:publicId`
  - body supports: `{ config?: object, status?: 'published'|'unpublished' }` (curated is always `published`)
- `GET /api/workspaces/:workspaceId`
- `GET /api/workspaces/:workspaceId/members`
- `GET /api/workspaces/:workspaceId/policy`
- `GET /api/workspaces/:workspaceId/entitlements`
- `GET /api/workspaces/:workspaceId/ai/profile`
- `GET /api/workspaces/:workspaceId/ai/limits`
- `GET /api/workspaces/:workspaceId/ai/outcomes` (explicit unavailable in this snapshot)
- `GET /api/accounts/:accountId`
- `GET /api/accounts/:accountId/workspaces`
- `POST /api/accounts/:accountId/workspaces` (Supabase session + `Idempotency-Key`)
- `GET /api/accounts/:accountId/usage`
- `GET /api/accounts/:accountId/assets`
- `GET /api/accounts/:accountId/assets/:assetId`
- `DELETE /api/accounts/:accountId/assets/:assetId`
- `GET /api/accounts/:accountId/billing/summary`
- `POST /api/accounts/:accountId/billing/checkout-session` (explicit not-configured in this snapshot)
- `POST /api/accounts/:accountId/billing/portal-session` (explicit not-configured in this snapshot)
- `POST /api/claims/minibob/complete` (Supabase session + signed claim token + `Idempotency-Key`)

## Curated vs user instances

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances` (local-only writes, widget_type validated against Tokyo).
- `wgt_*_u_*` → `widget_instances` (workspace-owned, RLS-enforced).

## Auth

Public in this repo snapshot:
- `GET /api/healthz`
- `GET /api/instance/:publicId` (published-only unless valid dev auth is present)
- `POST /api/ai/minibob/session`

Non-public endpoints require one of:
- `Authorization: Bearer <Supabase session JWT>` (Roma/control-plane path)
- `Authorization: Bearer ${PARIS_DEV_JWT}` (dev/internal compatibility path)

Strict Supabase-only productized bootstrap contracts:
- `POST /api/accounts`
- `POST /api/accounts/:accountId/workspaces`
- `POST /api/claims/minibob/complete`

Machine/internal endpoints can also use signature-based verification (for example metering and l10n job reporting).

## Required secrets/env

- `SUPABASE_URL` (env var)
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `AI_GRANT_HMAC_SECRET` (secret, used as claim-signing fallback)
- `MINIBOB_CLAIM_HMAC_SECRET` (secret, optional explicit claim-signing secret)
- `PARIS_DEV_JWT` (secret)

## Local dev

`pnpm dev:paris`

## Deploy

`pnpm --filter @clickeen/paris deploy`
