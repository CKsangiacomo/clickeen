# Berlin - Identity-To-Session Boundary

STATUS: REFERENCE - MUST MATCH RUNTIME
Runtime code + deploy config are truth. If this doc drifts from `berlin/*`, update it immediately.

For the canonical account-management model, see `documentation/architecture/AccountManagement.md`.

DB Pivot note: this doc is being converged to the active one-user-one-account model. Any mention of `user_profiles`, `account_members`, `active_account_id`, `login_identities`, or `accountPublicId` describes current runtime residue only, not the target model.

## Purpose

Berlin is Clickeen's identity-to-session boundary.

Given a verified provider identity, Berlin produces a valid, safe, scoped Clickeen session.

That means Berlin is not a pure token vending machine, and it is not the long-term home for every account-management workflow. Berlin owns login-time account truth: the minimum account read/write authority needed to answer:

- who is this person?
- which Clickeen user does this provider login map to?
- which account should this session land in?
- is this login allowed to create or accept access?
- what stable authz capsule does Roma/Bob need at session start?

Berlin must keep that login-time truth boring, explicit, and session-scoped. Rich account-management product surfaces are extraction targets, not the Berlin mandate.

## Permanent Mandate

Berlin permanently owns:

- OAuth PKCE start/callback flows for login providers.
- Provider login to Clickeen user mapping through the approved `users` login fields at Berlin's service-role boundary.
- First-login account provisioning when no invitation or existing user/account applies.
- Account id minting during account provisioning.
- Invitation acceptance at login time when the login flow carries an invitation context.
- Current account resolution for session landing. In the DB Pivot target there is exactly one account per user.
- Berlin access-token and refresh-token issuance.
- Refresh rotation and session revocation.
- JWKS publication for verifier services.
- `GET /auth/session` identity/session status.
- `GET /v1/session/bootstrap` as the read-only session bootstrap surface.
- The signed account authz capsule needed by Roma/Bob for the active account context.
- Request IDs, structured request-completion logs, and the first auth/session mutation rate-limit floor.

The signed account authz capsule carries stable account authz truth only. Mutable locale settings and live `used` counters stay out of the signed capsule. The capsule includes `accountPublicId`; Roma must carry that compact identity, not compute it. The capsule does not carry platform flags, fake account slugs, or account names derived from compact ids.

## Boundary Rules

- Direct provider login is the canonical cloud path: `Roma -> Berlin -> provider -> Berlin -> Roma`.
- Supabase Auth provider redirects are legacy residue and must not be reintroduced as the browser-visible customer login path.
- The current `public.login_identities` table is runtime residue and a DB Pivot deletion target. Berlin's target login mapping is the approved `users` login fields. Product shells must not consume Supabase Auth identities, provider payloads, or connector state as account truth.
- Bootstrap is read-only. It resolves real user/account state and mints session/bootstrap truth; it must not silently repair missing user, role, login mapping, or account state on the hot path.
- Bootstrap exposes the one current account id for the user. The old `accountId` plus `accountPublicId` split is not target DB Pivot truth.
- Missing canonical user, role, login mapping, or account state at bootstrap is a producer bug and must fail explicitly.
- Current account resolution comes from `users.account_id`. Berlin must never open a privileged fallback account.
- Invalid persisted profile/account locale-policy truth must fail explicitly in canonical product/account routes. Berlin logs the defect and does not silently default it away.
- Product shells must not treat login provider summaries as connector/account linkage. Login is not connector authorization.
- Future providers such as Apple, Microsoft, Meta/Facebook, or others plug into the same provider adapter shape: provider verifies identity; Berlin maps identity to Clickeen account/session truth.

## Current Extraction Targets

Berlin still hosts account-management surfaces from the PRD 65 account-boundary execution. They are current runtime surface, but they are not the corrected long-term Berlin mandate.

These surfaces must not be expanded in Berlin without a PRD:

- team/user CRUD currently backed by old account-member residue
- account locales management
- contact-method verification and profile mutation endpoints
- account governance and lifecycle operations
- post-login invitation listing, issuance, revocation, and team/user-management workflows
- account deletion outside the login/session boundary

Correct direction:

- Keep login-time account truth in Berlin.
- Move account-management product workflows to their surviving account-management boundary through a dedicated PRD.
- Do not preserve toxic or duplicate account truth just because a Berlin route currently exists.

## Runtime Surface

Canonical public auth/session routes:

- `GET /auth/login/:provider/start`
- `GET /auth/login/:provider/callback`
- `POST /auth/finish`
- `GET /auth/session`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /v1/session/bootstrap`

Residual public account-management routes:

- `GET /v1/me`
- `PUT /v1/me`
- `POST /v1/me/contact-methods/:channel/start`
- `POST /v1/me/contact-methods/:channel/verify`
- `GET /v1/me/identities`
- `GET /v1/accounts/:id`
- `DELETE /v1/accounts/:id`
- `PUT /v1/accounts/:id/locales`
- `GET /v1/accounts/:id/members`
- `GET /v1/accounts/:id/members/:memberId`
- `PATCH /v1/accounts/:id/members/:memberId`
- `DELETE /v1/accounts/:id/members/:memberId`
- `GET /v1/accounts/:id/invitations`
- `POST /v1/accounts/:id/invitations`
- `DELETE /v1/accounts/:id/invitations/:invitationId`
- `POST /v1/accounts/:id/owner-transfer`
- `POST /v1/invitations/:token/accept`
- `POST /v1/accounts/:id/lifecycle/tier-drop/dismiss`
- `GET /v1/accounts/:id/publish-containment`

`GET /v1/accounts/:id/publish-containment` is a policy-only read used by Roma's publish action boundary. Berlin reads `account_publish_containment` for the account block state and reason only; Tokyo remains the owner of widget instance inventory, editable config, display metadata, localization overlays, and publish/live state.

Berlin does not build, validate, migrate, or clean Tokyo/R2 account paths. Account-owned assets and instances use `accountPublicId` in Tokyo storage; private UUIDs stay relational and session-scoped. Product policy that affects asset storage, publication, downgrade, suspension, or stale-root cleanup belongs to Roma/system account operations, with Berlin only supplying the stable session/account truth and narrow account-governance reads named above.

Internal routes:

- `GET /.well-known/jwks.json`
- `GET /internal/healthz`

Health contract:

- `GET /internal/healthz` -> `{ "ok": true, "service": "berlin" }`

## Login Flow

Canonical Google login currently works like this:

1. Roma sends the browser to `GET /auth/login/google/start`.
2. Berlin validates provider, intent, next path, and an optional `finishRedirectUrl`.
3. Berlin creates a one-time OAuth state ticket in `BERLIN_AUTH_TICKETS`, including the selected finish redirect.
4. Berlin redirects to Google with PKCE and `prompt=select_account`.
5. Google redirects back to `GET /auth/login/google/callback`.
6. Berlin consumes the OAuth state ticket once.
7. Berlin exchanges the Google code directly with Google.
8. Berlin normalizes the Google userinfo response into a provider identity.
9. Berlin resolves or creates the Clickeen user/account landing state through the approved `users` model.
10. Berlin issues the Clickeen session.
11. Berlin stores a short-lived one-time finish transaction in `BERLIN_AUTH_TICKETS`.
12. Berlin redirects the browser to the selected finish route with only a `finishId`.
13. The selected surface redeems the finish transaction through `POST /auth/finish`, sets its surface-owned session cookies, and sends the user to the continuation path.

The browser is a redirect courier. It must never receive session material in the provider callback URL.

Roma does not send `finishRedirectUrl`; it continues to use `BERLIN_FINISH_REDIRECT_URL`.
DevStudio may send `finishRedirectUrl=https://devstudio.clickeen.com/api/session/finish`.
Requested finish redirects must be absolute `http`/`https` URLs, normalized by Berlin, and exactly present in the allowlist. `BERLIN_FINISH_REDIRECT_URL` is always included in that allowlist.

## Token Model

- Access token: Berlin-signed JWT (`RS256`), default TTL 15 minutes.
- Refresh token: opaque HMAC-signed Berlin token carrying internal refresh state, default TTL 30 days.
- Refresh rotation contract:
  - the first valid `/auth/refresh` rotates the session RTI and returns the next refresh token
  - one grace-window retry using the immediately previous refresh token is allowed so concurrent refresh attempts converge on the same next RTI instead of revoking a healthy session
  - replay of an old refresh token after the grace window is treated as reuse and revokes the session
  - refresh payload version `2` is the only accepted shape; old V1 refresh tokens force normal login
  - `POST /auth/logout` with `scope=user` revokes every session for the current user
  - logout with a specific refresh token revokes only that session
- Session cookies used by Roma/Bob:
  - `ck-access-token`
  - `ck-refresh-token`

Session state persistence:

- `BERLIN_SESSION_KV` is authoritative state in cloud-dev/prod and local-bound in local env.
- Valid session state must carry explicit `authMode`.
- `direct_provider` is the canonical Google/provider session mode.
- Supabase-bridge sessions are deleted; password login no longer creates Berlin product sessions.
- Old KV rows without `authMode` are invalid and force normal login.
- In-memory cache is a runtime optimization.
- Signing/HMAC key imports are cached on `globalThis` under the Cloudflare Workers isolate model.

OAuth transaction state:

- One-time opaque `state` IDs are persisted in `BERLIN_AUTH_TICKETS` with consume-once semantics.
- PKCE verifier + flow metadata are never encoded in callback URLs.
- The selected finish redirect is stored on the state ticket so callback returns the `finishId` to the same allowlisted surface that started login.

OAuth finish state:

- One-time opaque `finishId` records are persisted in `BERLIN_AUTH_TICKETS` with consume-once semantics.
- Browser callback redirects only carry `finishId`.
- Provider redirect allow-lists must target Berlin callback URLs only, not Roma callback URLs.

## Dependencies

Primary runtime dependencies:

- Cloudflare Workers for Berlin runtime.
- `BERLIN_AUTH_TICKETS` Durable Object for OAuth state and finish transactions.
- `BERLIN_SESSION_KV` for session state and auth/session mutation rate-limit buckets.
- Google OAuth/OIDC for the enabled cloud-dev login provider.
- Supabase persistence through Berlin's service-role boundary for users, accounts, and invitation state.

Registry/account product dependencies:

- Roma no longer receives a Michael/PostgREST token from Berlin.
- Berlin only answers account/user/session truth and the currently surviving account governance questions for this area.
- Berlin does not own widget instance inventory, instance IDs, display names, saved config, l10n overlays, or publish state.

## Account Public Coordinate

Berlin creates accounts with a compact `accounts.id` product coordinate:

- 8 uppercase base36 characters
- generated with the shared `@clickeen/ck-contracts` platform ID generator
- protected by Michael's primary key constraint
- retried on collision

`accountPublicId` remains the API/embed field name for this same compact `accounts.id` value. Berlin does not maintain a separate `accounts.public_id`, slug, alias, or vanity account coordinate.

Existing pre-GA account rows are corrected by append-only Supabase migrations. Berlin does not derive, repair, or recompute `accountPublicId` during bootstrap.

PRD 099 cleanup must not introduce UUID account folders in Tokyo. Any CI guard or migration dry-run that finds `accounts/{uuid}/assets/**`, `accounts/{uuid}/widgets/**`, or `accounts/{uuid}/instances/wgt_*` treats those keys as stale migration material requiring a restore manifest and rollback rehearsal before deletion.

## Environment

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BERLIN_AUTH_TICKETS` (Wrangler Durable Object binding)
- `BERLIN_SESSION_KV` (Wrangler KV binding)
- `BERLIN_ACCESS_PRIVATE_KEY_PEM`
- `BERLIN_ACCESS_PUBLIC_KEY_PEM`
- `BERLIN_REFRESH_SECRET`

Required for direct Google login:

- `BERLIN_GOOGLE_CLIENT_ID`
- `BERLIN_GOOGLE_CLIENT_SECRET`
- `BERLIN_GOOGLE_CALLBACK_URL`

Recommended:

- `BERLIN_ISSUER`
- `BERLIN_AUDIENCE`
- `BERLIN_ALLOWED_PROVIDERS` (default: `google`)
- `BERLIN_FINISH_REDIRECT_URL` (cloud-dev points at Roma `/api/session/finish`)
- `BERLIN_ALLOWED_FINISH_REDIRECT_URLS` (comma-separated additional absolute finish URLs; default finish URL is automatically allowed)
- `ENV_STAGE`

Optional key rotation:

- `BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM`
- `BERLIN_ACCESS_PREVIOUS_KID`

Berlin requires explicit signing key PEMs. Cloud environments provide them
directly; the old local `dev-up` key materialization path is retired.

## Runtime

- Cloud-dev URL: `https://berlin.dev.clickeen.com`
- Cloud-dev Google callback: `https://berlin.dev.clickeen.com/auth/login/google/callback`
- Berlin reuses the access signing keypair for account capsules. There is no separate capsule secret to distribute.

## Operational Floor

Berlin emits one structured JSON completion log per request with:

- `event`
- `service`
- `stage`
- `requestId`
- `method`
- `path`
- `status`
- `durationMs`

Berlin returns `x-request-id` on every response so Roma/internal callers can correlate failures to Berlin logs.

The current rate-limit floor is intentionally narrow:

- key = per-IP bucket
- storage = `BERLIN_SESSION_KV` under a dedicated prefix
- protected routes = auth/session mutation routes only
- missing `BERLIN_SESSION_KV` or missing client IP is service/request-contract failure before protected route dispatch
- limited responses return `429 coreui.errors.rateLimit.exceeded` plus `retry-after` and `x-rate-limit-*` headers
