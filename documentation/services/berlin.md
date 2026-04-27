# Berlin - Identity-To-Session Boundary

STATUS: REFERENCE - MUST MATCH RUNTIME
Runtime code + deploy config are truth. If this doc drifts from `berlin/*`, update it immediately.

For the canonical account-management model, see `documentation/architecture/AccountManagement.md`.

## Purpose

Berlin is Clickeen's identity-to-session boundary.

Given a verified provider identity, Berlin produces a valid, safe, scoped Clickeen session.

That means Berlin is not a pure token vending machine, and it is not the long-term home for every account-management workflow. Berlin owns login-time account truth: the minimum account read/write authority needed to answer:

- who is this person?
- which Clickeen user profile does this provider identity map to?
- which account should this session land in?
- is this login allowed to create or accept access?
- what stable authz capsule does Roma/Bob need at session start?

Berlin must keep that login-time truth boring, explicit, and session-scoped. Rich account-management product surfaces are extraction targets, not the Berlin mandate.

## Permanent Mandate

Berlin permanently owns:

- OAuth PKCE start/callback flows for login providers.
- Provider identity to Clickeen user mapping through the `resolve_login_identity` RPC and `login_identities`.
- First-login account provisioning when no invitation or existing membership applies.
- Invitation acceptance at login time when the login flow carries an invitation context.
- Active account resolution for session landing.
- Berlin access-token and refresh-token issuance.
- Refresh rotation and session revocation.
- JWKS publication for verifier services.
- `GET /auth/session` identity/session status.
- `GET /v1/session/bootstrap` as the read-only session bootstrap surface.
- The signed account authz capsule needed by Roma/Bob for the active account context.
- Request IDs, structured request-completion logs, and the first auth/session mutation rate-limit floor.

The signed account authz capsule carries stable account authz truth only. Mutable locale settings and live `used` counters stay out of the signed capsule.

## Boundary Rules

- Direct provider login is the canonical cloud path: `Roma -> Berlin -> provider -> Berlin -> Roma`.
- Supabase Auth provider redirects are legacy residue and must not be reintroduced as the browser-visible customer login path.
- The current linked-identity source is `public.login_identities`, with first-login provider races resolved by the database-owned `resolve_login_identity` RPC. Supabase Auth identities may exist as legacy migration residue, but product shells must not consume them as provider/account truth.
- Bootstrap is read-only. It resolves real user/account state and mints session/bootstrap truth; it must not silently repair missing profile, membership, or account state on the hot path.
- Missing canonical profile, membership, or active account state at bootstrap is a producer bug and must fail explicitly.
- Active account resolution comes only from persisted active-account preference or deterministic real membership truth. Berlin must never open a privileged fallback account.
- Invalid persisted profile/account locale-policy truth must fail explicitly in canonical product/account routes. Berlin logs the defect and does not silently default it away.
- Product shells may consume Berlin's normalized provider summary, but must not invent provider/account linkage outside Berlin.
- Future providers such as Apple, Microsoft, Meta/Facebook, or others plug into the same provider adapter shape: provider verifies identity; Berlin maps identity to Clickeen account/session truth.

## Current Extraction Targets

Berlin still hosts account-management surfaces from the PRD 65 account-boundary execution. They are current runtime surface, but they are not the corrected long-term Berlin mandate.

These surfaces must not be expanded in Berlin without a PRD:

- account members CRUD
- account locales management
- contact-method verification and profile mutation endpoints
- account governance and lifecycle operations
- post-login invitation listing, issuance, revocation, and member-management workflows
- general account creation/deletion outside the login/session boundary

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

Legacy/compatibility auth routes:

- `POST /auth/login/provider/start`
- `GET /auth/login/provider/callback`

Residual public account-management routes:

- `GET /v1/me`
- `PUT /v1/me`
- `POST /v1/me/email-change`
- `POST /v1/me/contact-methods/:channel/start`
- `POST /v1/me/contact-methods/:channel/verify`
- `GET /v1/me/identities`
- `GET /v1/accounts`
- `POST /v1/accounts`
- `GET /v1/accounts/:id`
- `DELETE /v1/accounts/:id`
- `PUT /v1/accounts/:id/locales`
- `GET /v1/accounts/:id/members`
- `POST /v1/accounts/:id/members`
- `GET /v1/accounts/:id/members/:memberId`
- `PATCH /v1/accounts/:id/members/:memberId`
- `DELETE /v1/accounts/:id/members/:memberId`
- `GET /v1/accounts/:id/invitations`
- `POST /v1/accounts/:id/invitations`
- `DELETE /v1/accounts/:id/invitations/:invitationId`
- `POST /v1/accounts/:id/owner-transfer`
- `POST /v1/invitations/:token/accept`
- `POST /v1/accounts/:id/switch`
- `POST /v1/accounts/:id/lifecycle/tier-drop/dismiss`
- `GET /v1/accounts/:id/widget-registry`
- `GET /v1/accounts/:id/instances/public-ids`
- `POST /v1/accounts/:id/instances/registry`
- `GET /v1/accounts/:id/instances/:publicId/registry`
- `DELETE /v1/accounts/:id/instances/:publicId/registry`
- `GET /v1/accounts/:id/publish-containment`
- `GET /v1/templates/registry`

Internal routes:

- `GET /.well-known/jwks.json`
- `GET /internal/healthz`
- `POST /internal/control/users/:userId/revoke-sessions`

Health contract:

- `GET /internal/healthz` -> `{ "ok": true, "service": "berlin" }`

## Login Flow

Canonical Google login currently works like this:

1. Roma sends the browser to `GET /auth/login/google/start`.
2. Berlin validates provider, intent, and next path.
3. Berlin creates a one-time OAuth state ticket in `BERLIN_AUTH_TICKETS`.
4. Berlin redirects to Google with PKCE and `prompt=select_account`.
5. Google redirects back to `GET /auth/login/google/callback`.
6. Berlin consumes the OAuth state ticket once.
7. Berlin exchanges the Google code directly with Google.
8. Berlin normalizes the Google userinfo response into a provider identity.
9. Berlin resolves or creates the Clickeen user/profile/account landing state through the DB-owned `resolve_login_identity` RPC, `login_identities`, and account membership truth.
10. Berlin issues the Clickeen session.
11. Berlin stores a short-lived one-time finish transaction in `BERLIN_AUTH_TICKETS`.
12. Berlin redirects the browser to Roma's finish route with only a `finishId`.
13. Roma redeems the finish transaction through `POST /auth/finish`, sets its product cookies, and sends the user to the continuation path.

The browser is a redirect courier. It must never receive session material in the provider callback URL.

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
- Supabase/Michael persistence through Berlin's service-role boundary for user profile, login identity, account, membership, invitation state, and the `resolve_login_identity` RPC.

Registry/account product dependencies:

- Roma no longer receives a Michael/PostgREST token from Berlin.
- Berlin owns the residual account registry product endpoints listed above and reads Michael internally through its service-role boundary.
- Roma combines those registry responses with Tokyo/Tokyo-worker saved-document and serve-state truth.

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
- `ENV_STAGE`
- `CK_INTERNAL_SERVICE_JWT` only for explicit local/internal control tooling, not for Berlin/Roma Cloudflare product paths.

Legacy/compatibility:

- `BERLIN_LOGIN_CALLBACK_URL` configures the old generic provider callback route, `/auth/login/provider/callback`.

Optional key rotation:

- `BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM`
- `BERLIN_ACCESS_PREVIOUS_KID`

Berlin requires explicit signing key PEMs. Local `dev-up` materializes them into `berlin/.dev.vars`, and cloud environments must provide them directly.

## Local Development

- Local URL: `http://localhost:3005`
- Canonical startup: `bash scripts/dev-up.sh`
- Local direct Google callback: `http://localhost:3005/auth/login/google/callback`
- `dev-up` reuses the Berlin access signing keypair for account capsules. There is no separate capsule secret to distribute.

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
- limited responses return `429 coreui.errors.rateLimit.exceeded` plus `retry-after` and `x-rate-limit-*` headers
