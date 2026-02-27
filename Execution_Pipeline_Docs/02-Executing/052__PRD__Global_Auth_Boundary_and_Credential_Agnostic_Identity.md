# PRD 052 - Berlin Auth Boundary (V1) and Credential-Agnostic Identity

Status: Executed in code (local green; cloud-dev deploy follow-up required for Roma login mint path)  
Date: 2026-02-27  
Owner: Product Dev Team  
Priority: P0  

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

Ship Berlin as the only AuthN boundary so Roma/Bob/Paris stop depending on Supabase/provider token details, while keeping identity stable and login methods flexible.

---

## Pre-GA execution stance (locked)

1. We are pre-GA and can make clean breaking changes.
2. We do not optimize this PRD for legacy zero-downtime migration complexity.
3. We optimize for clean architecture and fast, deterministic cutover.
4. We do not gold-plate enterprise auth platform features in v1.

---

## Why this PRD exists

Current auth coupling:
1. Roma login/session routes are Supabase-specific.
2. Bob/Paris auth helpers parse and validate Supabase JWT behavior.
3. Provider/auth details leak into product services.

Target:
1. Berlin handles AuthN and session lifecycle.
2. Paris handles AuthZ, workspace/account policy, and product control-plane logic.
3. Roma/Bob are host/orchestration surfaces, not auth engines.

---

## Decision (locked)

1. Dedicated auth service (`Berlin`) is the architecture.
2. No Paris-auth-module alternative in this PRD.
3. Supabase/provider auth details are internal to Berlin only.

---

## Pre-execution protocol (locked)

Execution order:
1. Execute strictly by slices: A -> B -> C -> D.
2. Do not start a later slice until the current slice gate is green.
3. Keep one active auth token contract in code during cutover (Berlin token contract).

Anti-derail defaults:
1. No speculative refactors outside auth boundary cutover.
2. No new abstractions unless required by the current slice gate.
3. Fix failures at source slice; do not add temporary bypasses.
4. Do not reintroduce Supabase-token parsing outside Berlin.
5. Preserve existing host/runtime contracts (`ck:open-editor`, Roma->Bob handoff shape).

Change discipline:
1. Scope every PR/commit to one slice goal plus required shared utility edits only.
2. Keep legacy removal in the same slice that replaces it (avoid dual-path drift).
3. If an ambiguity appears, resolve to the simplest contract-preserving option and document it in this PRD section before expanding scope.

---

## Non-negotiable contracts

1. `userId` is immutable system identity.
2. `accountId` is immutable ownership/metering identity.
3. Email is never the identity anchor.
4. No implicit account merge by email.
5. Credential uniqueness is deterministic by `(provider, providerSubject)`.
6. AuthN and AuthZ stay separate:
   - Berlin = AuthN/session.
   - Paris = AuthZ/policy/membership.
7. Fail-visible conflicts:
   - no silent merge
   - no silent relink
   - explicit reason keys

---

## Scope (v1 only)

1. Add `berlin/` Worker with login, refresh, logout, session introspection, and provider callback handling.
2. Berlin mints Clickeen access tokens; Paris verifies via Berlin JWKS.
3. Migrate Roma session routes from direct Supabase to Berlin.
4. Migrate Bob/Paris auth path to Berlin tokens.
5. Implement explicit credential linking rules (no auto-merge by email).
6. Keep runtime parity gates blocking in local and cloud-dev.

## Out of scope (deferred)

1. Full identity re-key migration (`workspace_members.user_id` away from `auth.users.id`) in v1.
2. Enterprise step-up auth UX.
3. Full refresh-family compromise forensics platform.
4. Session management UI.
5. SAML/SCIM enterprise provisioning.
6. Provider abstraction framework beyond what is required for Google-first + additive providers.

---

## Architecture (v1)

```
Client (Roma/Bob)
  -> Berlin /auth/*
  -> Berlin session cookies + access token path
  -> Roma/Bob APIs forward Berlin access token

Paris
  -> verify Berlin token via JWKS
  -> resolve memberships/policy/capsules
  -> no Supabase auth token parsing

Supabase/Auth Providers
  -> internal dependency behind Berlin only
```

Boundary rules:
1. Berlin tokens are the only product auth token accepted by Paris post-cutover.
2. Provider claims are not used by Paris for authorization.
3. Any account/workspace context in token is hint-only; authorization truth remains Paris membership/policy checks.
4. Berlin does not own or persist active account/workspace authorization state.

---

## Token/session contract (v1)

### Access token

Berlin-signed, short TTL (target 15m), minimal claims:
1. `sub` (`userId`)
2. `sid` (session id)
3. `ver` (session/auth version for revocation)
4. `iat`
5. `exp`
6. `iss`
7. `aud`

Constraints:
1. No provider-specific claims required by Paris.
2. No claim should bypass Paris membership checks.

### Session/refresh

1. Server-managed refresh/session state in Berlin store (KV or equivalent for v1).
2. HttpOnly + Secure cookies set server-side only.
3. Refresh rotation required in v1 baseline.

Minimal refresh rotation semantics (v1):
1. One active refresh token per `sid`.
2. Refresh call rotates refresh token and invalidates prior token immediately.
3. Reuse of an already-rotated refresh token revokes that `sid` and returns auth-required.
4. No refresh-family forensics in v1 (deferred backlog).

### Signing key rotation (JWKS)

1. Berlin publishes current + previous signing keys in `/.well-known/jwks.json`.
2. Paris accepts both keys during a bounded overlap window (target 6h).
3. After overlap expiry, previous key is removed and old tokens naturally expire.

---

## Cookie and domain contract (v1, locked)

1. Cloud-dev cookie scope is `.dev.clickeen.com`; Roma, Bob, and Berlin run on sibling subdomains.
2. Local product surfaces use `localhost` hostnames only; do not mix `localhost` and `127.0.0.1` across Roma/Bob/Berlin hosts.
3. Session cookies are `HttpOnly`, `Path=/`, `SameSite=Lax`; `Secure` is required on HTTPS (cloud-dev/prod).
4. Bob iframe flows must not depend on Bob reading Berlin cookies directly.
5. Roma server routes are the auth handoff boundary for Bob message-boot flows.

---

## Identity model (v1 and forward-compatible)

1. `userId` remains stable and immutable.
2. In v1, `userId` may equal current Supabase user id to avoid re-key blast radius.
3. Credential methods are linked to `userId`; they are replaceable.
4. `accountId` and `workspaceId` behavior is unchanged in this PRD.

Optional additive table in v1 (allowed, not required):
1. `core_users` mirror where `core_users.id == auth.users.id`.
2. This is additive only and does not force RLS re-key in v1.

---

## Provider linking rules (hard)

1. No auto-merge when emails match.
2. Linking an additional provider must be explicit from authenticated session context.
3. `(provider, providerSubject)` is unique globally.
4. If provider identity is already linked elsewhere, return conflict error.
5. Unlink cannot leave user with zero valid sign-in methods.

---

## Global-first login posture

1. Google is first mandatory provider in v1.
2. Apple/Facebook can be added without changing Paris/Roma/Bob auth contracts.
3. Login provider choice is UX/config, not identity-model change.
4. Connector OAuth (Instagram/Facebook data-source auth) remains a separate domain from user authentication.

---

## Berlin API surface (v1)

Public:
1. `POST /auth/login/password`
2. `POST /auth/login/provider/start`
3. `GET /auth/login/provider/callback`
4. `POST /auth/refresh`
5. `POST /auth/logout`
6. `GET /auth/session`
7. `POST /auth/link/start`
8. `GET /auth/link/callback`
9. `POST /auth/unlink`

Internal:
1. `GET /.well-known/jwks.json`
2. `GET /internal/healthz`

Endpoint behavior notes (v1):
1. `POST /auth/refresh` rotates refresh state and returns a fresh Berlin access token for the existing authenticated session.
2. `GET /auth/session` returns identity/session status only (`userId`, `sid`, expiry); it does not return authorization grants.

Standard error envelope:
```json
{
  "error": {
    "kind": "AUTH",
    "reasonKey": "coreui.errors.auth.required",
    "detail": "optional"
  }
}
```

---

## Pre-execution readiness checklist (must be true before Slice A)

1. Local startup path confirmed: `bash scripts/dev-up.sh`.
2. Berlin service env contract defined for local + cloud-dev (issuer, audience, signing key, cookie domain policy).
3. Paris env has Berlin JWKS/issuer/audience verification inputs.
4. Roma/Bob env has Berlin base URL and no direct Supabase auth dependency in new routes.
5. Runtime parity commands are available in current branch and runnable from local shell.
6. No unresolved architectural decisions remain for token claims, cookie policy, or Roma->Bob handoff path.

---

## Execution slices

### Slice A - Berlin foundation (P0)

1. Create `berlin/` Worker.
2. Implement Google login flow and password flow.
3. Implement token mint + JWKS publish + refresh + logout.
4. Implement basic session revocation by `sid` and by `userId`.

Gate:
1. Berlin local auth flow works end-to-end.
2. JWKS verification works from test harness.

### Slice B - Paris auth cutover (P0)

1. Add Berlin token verification in `paris/src/shared/auth.ts`.
2. Remove Supabase `/auth/v1/user` lookup from Paris request auth path.
3. Keep existing workspace/account authz and capsule contracts unchanged.

Gate:
1. Authenticated Paris endpoints work with Berlin token.
2. Supabase tokens rejected by Paris post-cutover.

### Slice C - Roma/Bob session cutover (P0)

1. Update Roma session routes:
   - `roma/app/api/session/login/route.ts`
   - `roma/app/api/session/logout/route.ts`
   - `roma/app/api/session/access-token/route.ts`
   - `roma/lib/auth/session.ts`
2. Update Bob auth helpers:
   - `bob/lib/auth/session.ts`
   - `bob/lib/api/paris/proxy-helpers.ts`
3. Keep `ck:open-editor` and host handoff contract shape unchanged.
4. Lock handoff path:
   - Roma `GET /api/session/access-token` calls Berlin `POST /auth/refresh` server-to-server using session cookie.
   - Roma returns `sessionAccessToken` to Bob host payload and forwards any rotated session cookie.
   - Bob uses `sessionAccessToken` for same-origin `/api/*` auth and does not rely on cross-site cookie reads.

Gate:
1. Builder boot/open/publish behavior unchanged under parity tests.

### Slice D - Linking rules and conflict handling (P1 inside this PRD)

1. Implement explicit link/unlink endpoints.
2. Enforce no-email-auto-merge and unique provider identity constraints.
3. Add reason-keyed conflict responses.

Gate:
1. Link second provider to same user works.
2. Conflict to other user fails visibly with deterministic reason key.

---

## Acceptance criteria (must all pass)

1. User can sign in with Google and keep stable `userId/accountId`.
2. Same user can link second provider and sign in with either method to same data.
3. Paris validates Berlin tokens locally via JWKS.
4. Paris no longer depends on Supabase token parsing/`/auth/v1/user`.
5. Roma bootstrap + Bob builder flows remain green.
6. Minibob handoff (`start/complete`) remains functional with Berlin-authenticated sessions.
7. No endpoint uses email as ownership key.
8. No service outside Berlin needs provider-specific token semantics.
9. Roma->Bob handoff uses `GET /api/session/access-token` backed by Berlin `POST /auth/refresh`.
10. Local parity uses consistent `localhost` product origins with no auth break from host mismatch.

---

## Runtime gates (blocking)

Gate execution policy:
1. During a slice, run targeted checks first for fast feedback.
2. Before marking any P0 slice complete, run full local blocking gate list.
3. Run cloud-dev blocking gates only after local list is fully green.
4. Do not proceed to next slice on partial gate success.

Local:
1. `bash scripts/dev-up.sh --reset`
2. `pnpm test:bootstrap-parity`
3. `pnpm test:runtime-parity:public`
4. `pnpm test:runtime-parity:auth`
5. `pnpm test:paris-boundary`
6. `pnpm test:bob-bootstrap-boundary`
7. `pnpm lint`
8. `pnpm typecheck`

Cloud-dev:
1. `pnpm test:bootstrap-parity:cloud-dev`
2. `pnpm test:runtime-parity:cloud-dev:public`
3. `pnpm test:runtime-parity:cloud-dev:auth`
4. `pnpm test:runtime-parity:cross-env`

---

## Risks and mitigations

1. Risk: auth cutover breaks boot flows.  
Mitigation: runtime parity suites remain blocking.
2. Risk: accidental account merge.  
Mitigation: no-email-auto-merge, providerSubject uniqueness, explicit linking only.
3. Risk: token misuse for authz bypass.  
Mitigation: Paris membership/policy remains source of authorization truth.
4. Risk: provider outage.  
Mitigation: multi-method login support, password/passkey fallback path.

---

## Deferred hardening backlog (explicitly not v1)

1. Step-up auth flows.
2. Deep refresh-family compromise analytics.
3. Full session management UI.
4. Full `core_users` re-key migration across membership FKs and RLS.
5. SAML/SCIM enterprise auth surface.

These items require a separate hardening PRD after Berlin boundary is stable.

---

## Definition of done

1. Berlin is the only AuthN boundary used by product runtime.
2. Paris verifies Berlin tokens and does not parse Supabase provider auth tokens.
3. Roma/Bob session behavior remains parity-green.
4. Identity remains decoupled from email/provider changes.
5. Canonical docs in `documentation/` are updated before moving this PRD to `03-Executed/`.

---

## Peer review checklist (must be answered)

1. Is v1 scope boring and minimal enough for pre-GA execution?
2. Is the AuthN/AuthZ boundary clean with no provider leakage into Paris?
3. Are no-email-auto-merge and explicit linking rules unambiguous?
4. Does v1 avoid unnecessary RLS/FK re-key blast radius?
5. Are blocking runtime gates sufficient to catch host/runtime regressions?
