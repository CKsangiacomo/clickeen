# Berlin — Auth Boundary Service

STATUS: REFERENCE — MUST MATCH RUNTIME
Runtime code + deploy config are truth. If this doc drifts from `berlin/*`, update it immediately.

For the canonical target account-management boundary, see `documentation/architecture/AccountManagement.md`.

## Purpose

Berlin is Clickeen's dedicated AuthN boundary and the executing account-truth boundary for PRD 064.

Responsibilities:
- Accept user credentials for sign-in (`/auth/login/password` in v1).
- Orchestrate provider login OAuth start+callback (`/auth/login/provider/*`).
- Reconcile first successful sign-in into canonical product account state (`user_profiles`, first account, first owner membership, active account preference) during PRD 064 execution.
- Own the first canonical account routes during PRD 064 execution:
  - `GET /v1/me`
  - `PUT /v1/me`
  - `GET /v1/me/identities`
  - `GET /v1/accounts`
  - `POST /v1/accounts`
  - `GET /v1/accounts/:id`
  - `DELETE /v1/accounts/:id`
  - `PUT /v1/accounts/:id/locales`
  - `GET /v1/accounts/:id/members`
  - `GET /v1/accounts/:id/members/:memberId`
  - `GET /v1/accounts/:id/invitations`
  - `POST /v1/accounts/:id/invitations`
  - `DELETE /v1/accounts/:id/invitations/:invitationId`
  - `PATCH /v1/accounts/:id/members/:memberId`
  - `PATCH /v1/accounts/:id/members/:memberId/profile`
  - `POST /v1/accounts/:id/owner-transfer`
  - `POST /v1/invitations/:token/accept`
  - `POST /v1/accounts/:id/switch`
  - `PUT /v1/accounts/:id/tier`
  - `POST /v1/accounts/:id/lifecycle/tier-drop/dismiss`
  - `GET /v1/session/bootstrap`
- Resolve the active account, role, entitlement snapshot, and short-lived account authz capsule for bootstrap.
- Mint short-lived Berlin access tokens (`RS256`) with stable product claims (`sub`, `sid`, `ver`, `iat`, `exp`, `iss`, `aud`).
- Rotate refresh tokens via `/auth/refresh`.
- Revoke sessions via `/auth/logout`.
- Publish JWKS for verifier services (`/.well-known/jwks.json`).

Non-responsibilities:
- No downstream product decisioning or widget business logic.
- `POST /v1/accounts/:id/members` is an existing-user attach path only (`userId` + role for an already-resolved canonical profile). Unknown-person access must still go through invitation issuance + acceptance.

## Runtime surface (v1)

Public:
- `POST /auth/login/password`
- `POST /auth/login/provider/start` (canonical callback->finish flow only)
- `GET /auth/login/provider/callback`
- `POST /auth/finish`
- `GET /auth/session` (identity/session status only)
- `GET /v1/me`
- `PUT /v1/me`
- `GET /v1/me/identities`
- `GET /v1/accounts`
- `POST /v1/accounts`
- `GET /v1/accounts/:id`
- `DELETE /v1/accounts/:id`
- `PUT /v1/accounts/:id/locales`
- `GET /v1/accounts/:id/members`
- `GET /v1/accounts/:id/members/:memberId`
- `GET /v1/accounts/:id/invitations`
- `POST /v1/accounts/:id/invitations`
- `DELETE /v1/accounts/:id/invitations/:invitationId`
- `PATCH /v1/accounts/:id/members/:memberId`
- `PATCH /v1/accounts/:id/members/:memberId/profile`
- `POST /v1/accounts/:id/owner-transfer`
- `POST /v1/invitations/:token/accept`
- `POST /v1/accounts/:id/switch`
- `PUT /v1/accounts/:id/tier`
- `POST /v1/accounts/:id/lifecycle/tier-drop/dismiss`
- `GET /v1/session/bootstrap`
- `POST /auth/refresh`
- `POST /auth/logout`

Internal:
- `GET /.well-known/jwks.json`
- `GET /internal/healthz`

Health contract:
- `GET /internal/healthz` -> `{ "ok": true, "service": "berlin" }`

## Token model (v1)

- Access token: Berlin-signed JWT (`RS256`), default TTL 15 minutes.
- Refresh token: opaque HMAC-signed Berlin token carrying internal refresh state; default TTL 30 days.
- Session cookies used by Roma/Bob:
  - `ck-access-token`
  - `ck-refresh-token`
- Session state persistence:
  - `BERLIN_SESSION_KV` (authoritative state in cloud-dev/prod, local-bound in local env)
  - in-memory cache as runtime optimization
- OAuth transaction state:
  - One-time opaque `state` IDs are persisted in `BERLIN_AUTH_TICKETS` (Durable Object) with consume-once semantics
  - PKCE verifier + flow metadata are never encoded in callback URLs
- OAuth finish state:
  - One-time opaque `finishId` records are persisted in `BERLIN_AUTH_TICKETS` (Durable Object) with consume-once semantics
  - Browser callback redirects only carry `finishId` (no access/refresh tokens in URL)
  - Provider redirect allow-list must target Berlin callback URLs only (no Roma callback entries)

## Dependencies

- Supabase Auth (internal to Berlin only for credential verification and refresh grant rotation).
- Supabase GoTrue provider/link endpoints (internal only; no provider leakage outside Berlin).

## Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BERLIN_AUTH_TICKETS` (Wrangler Durable Object binding)
- `BERLIN_SESSION_KV` (Wrangler binding)

Recommended:
- `BERLIN_ISSUER`
- `BERLIN_AUDIENCE`
- `BERLIN_REFRESH_SECRET`
- `BERLIN_ALLOWED_PROVIDERS` (default: `google`)
- `BERLIN_LOGIN_CALLBACK_URL` (OAuth provider callback URL; cloud-dev should point at Berlin `/auth/login/provider/callback`)
- `BERLIN_FINISH_REDIRECT_URL` (post-callback browser redirect; cloud-dev should point at Roma `/api/session/finish`)
- `ENV_STAGE`
- `CK_ADMIN_ACCOUNT_ID`
- `PARIS_BASE_URL` (required for locale-settings aftermath handoff to Paris orchestration)
- `PARIS_DEV_JWT` (required for Berlin -> Paris internal aftermath auth)
- `ROMA_AUTHZ_CAPSULE_SECRET` (falls back to `AI_GRANT_HMAC_SECRET`, then `SUPABASE_SERVICE_ROLE_KEY`)
- `USAGE_KV` (required for non-local bootstrap budget usage reads)
- `RENDER_SNAPSHOT_QUEUE` (required for tier-drop live-surface cleanup / mirror enforcement)

Optional key override:
- `BERLIN_ACCESS_PRIVATE_KEY_PEM`
- `BERLIN_ACCESS_PUBLIC_KEY_PEM`
- `BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM`
- `BERLIN_ACCESS_PREVIOUS_KID`

If signing key PEMs are not provided, Berlin generates an in-memory RSA keypair at runtime.

## Local development

- Local URL: `http://localhost:3005`
- Canonical startup: `bash scripts/dev-up.sh`
