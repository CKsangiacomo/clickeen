# Berlin — Auth Boundary Service

STATUS: REFERENCE — MUST MATCH RUNTIME
Runtime code + deploy config are truth. If this doc drifts from `berlin/*`, update it immediately.

## Purpose

Berlin is Clickeen's dedicated AuthN boundary.

Responsibilities:
- Accept user credentials for sign-in (`/auth/login/password` in v1).
- Orchestrate provider login/link OAuth start+callback (`/auth/login/provider/*`, `/auth/link/*`).
- Mint short-lived Berlin access tokens (`RS256`) with stable product claims (`sub`, `sid`, `ver`, `iat`, `exp`, `iss`, `aud`).
- Rotate refresh tokens via `/auth/refresh`.
- Revoke sessions via `/auth/logout`.
- Publish JWKS for verifier services (`/.well-known/jwks.json`).

Non-responsibilities:
- No workspace/account authorization policy decisions (Paris owns AuthZ).
- No product business logic.

## Runtime surface (v1)

Public:
- `POST /auth/login/password`
- `POST /auth/login/provider/start`
- `GET /auth/login/provider/callback`
- `POST /auth/link/start`
- `GET /auth/link/callback`
- `POST /auth/unlink`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/session`
- `GET /auth/validate` (alias to session validation contract)

Internal:
- `GET /.well-known/jwks.json`
- `GET /internal/healthz`

## Token model (v1)

- Access token: Berlin-signed JWT (`RS256`), default TTL 15 minutes.
- Refresh token: opaque HMAC-signed Berlin token carrying internal refresh state; default TTL 30 days.
- Session cookies used by Roma/Bob:
  - `ck-access-token`
  - `ck-refresh-token`
- Session state persistence:
  - `BERLIN_SESSION_KV` (authoritative state in cloud-dev/prod, local-bound in local env)
  - in-memory cache as runtime optimization

## Dependencies

- Supabase Auth (internal to Berlin only for credential verification and refresh grant rotation).
- Supabase GoTrue provider/link endpoints (internal only; no provider leakage outside Berlin).

## Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `BERLIN_SESSION_KV` (Wrangler binding)

Recommended:
- `BERLIN_ISSUER`
- `BERLIN_AUDIENCE`
- `BERLIN_REFRESH_SECRET`
- `BERLIN_ALLOWED_PROVIDERS` (default: `google`)
- `BERLIN_OAUTH_STATE_SECRET` (defaults to refresh secret when omitted)

Optional key override:
- `BERLIN_ACCESS_PRIVATE_KEY_PEM`
- `BERLIN_ACCESS_PUBLIC_KEY_PEM`
- `BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM`
- `BERLIN_ACCESS_PREVIOUS_KID`

If signing key PEMs are not provided, Berlin generates an in-memory RSA keypair at runtime.

## Local development

- Local URL: `http://localhost:3005`
- Canonical startup: `bash scripts/dev-up.sh`
