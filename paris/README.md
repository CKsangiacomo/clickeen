# Paris

Cloudflare Worker API service.

This README is a quick operational guide. For the full endpoint and behavior contract, see:
- `documentation/services/paris.md`

## Endpoints

Core shipped endpoints in this repo snapshot include:
- `GET /api/healthz`
- `GET /api/me` (`workspaceId` query optional; when provided, defaults are resolved only for that membership)
- `POST /api/accounts` (Berlin session bearer + `Idempotency-Key`)
- `GET /api/roma/widgets?workspaceId=<uuid>` (Roma widgets domain list; metadata only, no instance `config` payload; includes active-workspace user instances plus account-owned curated/main starters)
- `GET /api/roma/templates?workspaceId=<uuid>` (Roma templates domain list; all curated/main starters available to authenticated workspace members)
- `POST /api/roma/widgets/duplicate` (Roma widgets command; duplicates a source instance into workspace-owned user instance server-side)
- `DELETE /api/roma/instances/:publicId?workspaceId=<uuid>` (Roma widgets command; deletes workspace or account-owned curated instance when authorized)
- `GET /api/curated-instances`
  - optional query: `includeConfig=0|1` (default `1`; set `0` for lightweight list responses without `config`)
- `GET /api/workspaces/:workspaceId/instances`
- `POST /api/workspaces/:workspaceId/instances`
- `GET /api/workspaces/:workspaceId/instance/:publicId`
- `PUT /api/workspaces/:workspaceId/instance/:publicId`
- `GET /api/instance/:publicId`
- `GET /api/workspaces/:workspaceId`
- `GET /api/workspaces/:workspaceId/members`
- `GET /api/workspaces/:workspaceId/policy`
- `GET /api/workspaces/:workspaceId/entitlements`
- `GET /api/workspaces/:workspaceId/ai/profile`
- `GET /api/workspaces/:workspaceId/ai/limits`
- `GET /api/workspaces/:workspaceId/ai/outcomes` (explicit unavailable in this snapshot)
- `GET /api/accounts/:accountId`
- `GET /api/accounts/:accountId/workspaces`
- `POST /api/accounts/:accountId/workspaces` (Berlin session bearer + `Idempotency-Key`)
- `GET /api/accounts/:accountId/usage`
- `GET /api/accounts/:accountId/assets`
  - query projections:
    - `view=all` (default account library)
    - `view=used_in_workspace&workspaceId=<uuid>` (account assets currently used in that workspace)
    - `view=created_in_workspace&workspaceId=<uuid>` (account assets created from that workspace)
- `GET /api/accounts/:accountId/assets/:assetId` (supports the same optional `view/workspaceId` projection filters)
- `DELETE /api/accounts/:accountId/assets/:assetId`
- `GET /api/accounts/:accountId/billing/summary`
- `POST /api/accounts/:accountId/billing/checkout-session` (explicit not-configured in this snapshot)
- `POST /api/accounts/:accountId/billing/portal-session` (explicit not-configured in this snapshot)
- `POST /api/minibob/handoff/start` (public; stores server-side handoff snapshot and returns `handoffId`)
- `POST /api/minibob/handoff/complete` (Berlin session bearer + `handoffId` + `Idempotency-Key`)
  - accepts only curated/base MiniBob source ids (`wgt_main_*` or `wgt_curated_*`) and always creates a new `wgt_*_u_*` record

## Curated vs user instances

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances` (local-only writes, widget_type validated against Tokyo).
- `wgt_*_u_*` → `widget_instances` (workspace-owned, RLS-enforced).

## Auth

Public in this repo snapshot:
- `GET /api/healthz`
- `GET /api/instance/:publicId` (published-only for user-owned instances)
- `POST /api/ai/minibob/session`

Non-public product endpoints require:
- `Authorization: Bearer <Berlin access token>`

Strict Berlin-authenticated productized bootstrap contracts:
- `POST /api/accounts`
- `POST /api/accounts/:accountId/workspaces`
- `POST /api/minibob/handoff/complete`

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
