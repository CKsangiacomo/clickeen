# Paris

Cloudflare Worker API service.

This README is a quick operational guide. For the full endpoint and behavior contract, see:
- `documentation/services/paris.md`

## Endpoints

Core shipped endpoints in this repo snapshot include:
- `GET /api/healthz`
- `GET /api/me` (optional `accountId` query; when provided, defaults are resolved for that membership)
- `POST /api/accounts` (Berlin session bearer + `Idempotency-Key`)
- `GET /api/roma/bootstrap` (Roma shell bootstrap; identity + account authz capsule)
- `GET /api/roma/widgets?accountId=<uuid>` (Roma widgets domain list; includes account instances + curated owned by the admin account when authorized)
- `GET /api/roma/templates?accountId=<uuid>` (Roma templates domain list; all published curated/main starters available to authenticated account members)
- `POST /api/roma/widgets/duplicate` (Roma widgets command; duplicates a source instance into an account-owned user instance server-side)
- `DELETE /api/roma/instances/:publicId?accountId=<uuid>` (Roma widgets command; deletes account-owned instance when authorized; curated deletion is restricted to the admin account)
- `GET /api/curated-instances`
  - optional query: `includeConfig=0|1` (default `1`; set `0` for lightweight list responses without `config`)
- `GET /api/accounts/:accountId/instances`
- `POST /api/accounts/:accountId/instances?subject=account`
- `GET /api/accounts/:accountId/instance/:publicId?subject=account`
- `PUT /api/accounts/:accountId/instance/:publicId?subject=account`
- `GET /api/accounts/:accountId/instances/:publicId/publish/status`
- `GET /api/accounts/:accountId/locales`
- `PUT /api/accounts/:accountId/locales?subject=account`
- `GET /api/accounts/:accountId/instances/:publicId/l10n/status?subject=account`
- `POST /api/accounts/:accountId/instances/:publicId/l10n/enqueue-selected?subject=account`
- `GET/PUT/DELETE /api/accounts/:accountId/instances/:publicId/layers/...` (locale overrides storage)
- `GET /api/instance/:publicId`
- `GET /api/accounts/:accountId`
- `GET /api/accounts/:accountId/usage`
- `GET /api/accounts/:accountId/assets`
- `GET /api/accounts/:accountId/assets/:assetId`
- `DELETE /api/accounts/:accountId/assets/:assetId`
- `DELETE /api/accounts/:accountId/assets?confirm=1` (forced hard delete all account assets; downgrade/closure)
- `GET /api/accounts/:accountId/members`
- `GET /api/accounts/:accountId/notices?status=open|dismissed|resolved`
- `POST /api/accounts/:accountId/notices/:noticeId/dismiss`
- `GET /api/accounts/:accountId/billing/summary`
- `POST /api/accounts/:accountId/billing/checkout-session` (explicit not-configured in this snapshot)
- `POST /api/accounts/:accountId/billing/portal-session` (explicit not-configured in this snapshot)
- `POST /api/minibob/handoff/start` (public; stores server-side handoff snapshot and returns `handoffId`)
- `POST /api/minibob/handoff/complete` (Berlin session bearer + `handoffId` + `Idempotency-Key`)
  - accepts only curated/base MiniBob source ids (`wgt_main_*` or `wgt_curated_*`) and always creates a new `wgt_*_u_*` record

## Curated vs user instances

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances` (local-only writes, widget_type validated against Tokyo).
- `wgt_*_u_*` → `widget_instances` (account-owned, RLS-enforced).

## Auth

Public in this repo snapshot:
- `GET /api/healthz`
- `GET /api/instance/:publicId` (published-only for user-owned instances)
- `POST /api/ai/minibob/session`

Non-public product endpoints require:
- `Authorization: Bearer <Berlin access token>`

Strict Berlin-authenticated productized bootstrap contracts:
- `POST /api/accounts`
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
