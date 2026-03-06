# PRD 56 — System Convergence: Berlin Gatekeeper and Service Non-Interference

Status: EXECUTING (P0 remediation + convergence)
Date: 2026-03-05
Owner: Product Dev Team

Execution update (local):
- Berlin `/auth/finish` deterministic failure mapping tightened: malformed/unknown `finishId` now returns `422` (validation), replay returns `409`, expired returns `410`.
- Berlin `GET /auth/session` restored as a minimal identity/session-status route (`userId`, `sid`, `expiresAt`) so the route contract matches runtime again.
- Paris external bypass route removed: `GET/POST /api/accounts/:accountId/instances` no longer exposed from Paris router; instance creation remains server-owned through Roma orchestration handlers.
- Roma legacy password-login alias removed: `GET /api/session/post-login` hard-cut and login now routes directly to canonical `next` destination after cookie issuance.
- Password login hard-gated to local only: Berlin rejects `/auth/login/password` on non-local hosts, Roma rejects `POST /api/session/login` on non-local hosts, and the cloud Roma login page now hides the password form.
- Berlin legacy provider-link surface hard-cut: `/auth/link/start`, `/auth/link/callback`, `/auth/unlink`, and `/auth/validate` alias removed from runtime and docs.
- Roma auth completion/logout legacy cookie compatibility branches hard-cut: removed transitional `sb-*` cleanup logic and legacy-domain cookie-clearing loops from login/finish/logout handlers.

> Core mandate: Berlin is the gatekeeper to dreamland. Once user is in, services must stop fighting and each service must do only its job.

Context note:
- PRD 54 and PRD 55 are executed and moved to `03-Executed`.
- Current system drift is cross-service conflict: repeated re-validation, overlapping responsibilities, and conflicting fallback behavior.
- PRD 56 is expanded to fix auth and the service-fighting pattern in the same convergence program.

Environment contract:
- Canonical integration truth: cloud-dev (Cloudflare + shared remote Supabase dev).
- Local is for iteration only.
- Canonical local startup: `bash scripts/dev-up.sh`.

---

## Top Tenets (Non-Negotiable)

1. Clickeen is one simple web app.
- Multi-service topology is internal implementation detail.
- User must experience one coherent product flow.

2. Berlin is the gatekeeper.
- Berlin owns AuthN and session lifecycle only.
- Berlin success means user is in.

3. Once in, no service re-challenges auth truth.
- Services may enforce their own domain constraints.
- Services may not re-negotiate core auth state.

4. Each service has one job.
- Service boundaries are strict and boring.
- Smart fallback behavior that crosses boundaries is prohibited.

5. Determinism over cleverness.
- One canonical path per critical journey.
- Idempotent writes, replay-safe tickets, deterministic failure mapping.

6. Hard-cut legacy conflict paths.
- Temporary compatibility is allowed only with explicit expiry.
- Drift by coexistence is not allowed.

---

## One-line Objective

Converge auth and runtime boundaries so Clickeen behaves like one simple app: Berlin gets user in, Roma completes startup, and all other services run their bounded job without cross-service conflict.

---

## Product Contract (What "User Is In" Means)

User is in when all are true:
1. Berlin callback/finish completed successfully.
2. Roma set valid session cookies.
3. Roma established usable account context and entitlements context.
4. If flow came from MiniBob publish, handoff completion was attempted server-side with deterministic outcome.

After this point:
- Service failures are domain failures, not auth-boundary failures.
- No surprise auth loops.
- No user-facing surface/origin complexity.

---

## Service Boundary Contract (Who Does What)

| Service | Owns | Must Not Do |
|---|---|---|
| Prague | Entry/marketing CTA into auth start | OAuth callback handling, session issuance |
| Berlin | Provider start/callback, finish, session issue/refresh/logout, JWKS | Provisioning, product policy decisions, UI routing logic |
| Roma | Finish orchestration, cookie issuance, startup routing, recovery orchestration | Provider exchange, token crypto beyond consumption |
| Paris | AuthZ, account ensure/provision, handoff claim, instance policy writes | Provider OAuth, browser session semantics |
| Bob | Editor UX/runtime only | Critical auth completion or account provisioning |
| Venice | Embed read path from Tokyo published artifacts only | Paris dependency in embed path, auth/policy negotiation |
| Tokyo | Canonical artifact bytes/version refs | Product policy decisions |
| Tokyo-worker | Idempotent mirror/sync jobs | Product orchestration/auth logic |

Hard rule:
- If a behavior can be done by only one owner, no second owner may implement it.

---

## System Convergence Problems This PRD Fixes

1. Auth completion split across server and client timing.
2. Services repeatedly re-validating each other instead of consuming stable contracts.
3. Multiple parallel routes and fallback paths for same startup job.
4. Embed/runtime and asset paths adding cross-boundary checks not required for their primary job.
5. Legacy compatibility paths lingering long enough to become permanent behavior.

---

## Canonical Auth Journey (Single Path)

1. Entry from Prague or Roma reaches Roma auth start.
2. Roma calls Berlin `POST /auth/login/provider/start` with `{ provider, intent, next, handoffId? }`.
3. Berlin redirects to provider.
4. Provider returns to Berlin callback `GET /auth/login/provider/callback`.
5. Berlin validates callback and redirects browser to Roma `GET /api/session/finish?finishId=...`.
6. Roma finish handler runs server-side completion:
- redeem finish via Berlin `POST /auth/finish`
- set cookies
- ensure account context + entitlements context via Paris
- complete handoff when present
- redirect to final route

No client-side critical completion step is allowed.

---

## Canonical User Flows

### Flow A — Prague Create Free Account
1. User starts signup in Prague.
2. Canonical auth journey completes.
3. Roma ensures account + entitlements context.
4. User lands in workspace ready to operate.

### Flow B — Prague MiniBob Publish
1. MiniBob publish creates server-side `handoffId` snapshot.
2. Canonical auth journey completes.
3. Roma server ensures account and executes handoff claim.
4. User lands in builder continuity state.

### Flow C — Sign-in
1. User starts sign-in through Roma.
2. Canonical auth journey completes.
3. User lands on `next` with stable context.

---

## Cross-Service Runtime Invariants

1. One-way critical dependency graph:
- Auth path: Prague/Roma -> Berlin -> Roma -> Paris.
- Embed path: Venice -> Tokyo only.

2. No forbidden dependency on critical paths:
- Venice must not call Paris for embed runtime.
- Bob must not own critical auth completion.
- Berlin must not perform provisioning.

3. Single source of truth per domain:
- Auth session truth: Berlin.
- Account/AuthZ truth: Paris.
- Published artifact truth: Tokyo.
- Embed runtime read truth: Venice from Tokyo.

4. Deterministic failure classes:
- Auth failure, account-context failure, handoff failure, embed-asset failure are distinct and non-overlapping.

---

## Route Contracts (Minimal)

Berlin:
1. `POST /auth/login/provider/start`
2. `GET /auth/login/provider/callback`
3. `POST /auth/finish`
4. `POST /auth/refresh`
5. `POST /auth/logout`
6. `GET /auth/session`
7. `GET /.well-known/jwks.json`

Roma:
1. `GET /api/session/login/google`
2. `GET /api/session/finish`
3. `POST /api/session/logout`
4. `POST /api/session/login` (local/password only)

Paris (auth-adjacent):
1. `POST /api/accounts` (idempotent ensure-account semantics)
2. `POST /api/minibob/handoff/complete` (idempotent handoff claim)

Venice runtime contract:
1. Embed routes read published artifacts from Tokyo only.
2. No Paris dependency on embed request path.

---

## Persistence and Idempotency Contract

Berlin ticketing:
1. Authoritative store: Berlin Durable Object binding (`BERLIN_AUTH_TICKETS`) for `stateId` and `finishId`.
2. `stateId` TTL 10m, `finishId` TTL 5m.
3. Atomic consume-once semantics per ticket id in Durable Object storage.
4. Deterministic replay mapping:
- expired -> 410
- consumed -> 409
- malformed/unknown -> 422

Paris idempotency:
1. Ensure-account retries converge to one usable account context.
2. Handoff-complete retries converge to one logical claimed outcome.
3. Duplicate submit must not create duplicate durable results.

Tokyo/Tokyo-worker idempotency:
1. Worker jobs must be safely replayable.
2. Artifact promotion must be deterministic and revision-bound.

---

## Security and Session Contract

1. Access/refresh tokens never in URL query/fragment.
2. Browser-visible continuation carries only opaque `finishId`.
3. Roma is the only session-cookie issuer.
4. Cookie attributes fixed by environment policy (`HttpOnly`, `Secure` cloud-dev/prod, `SameSite=Lax`, deterministic domain).

---

## Failure and Recovery Contract

Auth deterministic redirects:
1. Provider denied -> `/login?error=coreui.errors.auth.provider.denied`
2. Invalid callback state -> `/login?error=coreui.errors.auth.provider.invalidCallback`
3. Invalid/replayed finish -> `/login?error=coreui.errors.auth.finish.invalidOrExpired`
4. Auth backend unavailable -> `/login?error=coreui.errors.auth.unavailable`

Post-auth recovery:
1. If session valid but account context missing, Roma runs recovery-safe ensure-account server-side.
2. Handoff terminal failure keeps valid session and routes deterministically with explicit handoff error state.
3. Recovery must not require user to restart auth unless auth is actually invalid.

---

## Expanded Execution Plan (Convergence Program)

### Phase 1 — Berlin gatekeeper correctness
1. Ship Berlin finish endpoint and callback->finish redirect.
2. Move continuation state to server-owned transaction records.
3. Enforce fail-fast provider/callback config checks.

Phase 1 gate:
- Canonical callback->finish works; no token leakage; replay probe deterministic.

### Phase 2 — Roma startup convergence
1. Ship canonical Roma finish handler as single completion gate.
2. Centralize cookie issuance and startup orchestration here.
3. Remove client-side critical completion dependencies.

Phase 2 gate:
- Browser refresh/close cannot orphan startup completion.

### Phase 3 — Paris convergence for startup domain
1. Confirm ensure-account semantics are idempotent and deterministic.
2. Confirm handoff complete semantics are idempotent and deterministic.
3. Tighten startup-time Paris error mapping to deterministic recovery paths.

Phase 3 gate:
- Concurrent retries converge without duplicate durable outcomes.

### Phase 4 — Venice and Tokyo boundary hardening
1. Audit Venice embed path to enforce Tokyo-only runtime dependency.
2. Remove unnecessary cross-service checks from Venice request path.
3. Confirm Tokyo/Tokyo-worker artifact path is deterministic and idempotent for published revisions.

Phase 4 gate:
- Embed requests are CDN/published-artifact deterministic and independent from Paris runtime availability.

### Phase 5 — Legacy conflict path hard-cut
1. Remove legacy callback/cookie continuation paths.
2. Remove temporary compatibility aliases.
3. Remove conflicting fallback logic that duplicates canonical behavior.

Phase 5 gate:
- One canonical path per job remains.

Compatibility window rule:
- Max 7 calendar days for temporary compatibility aliases after canonical rollout.

No phase skipping allowed.

---

## Execution Discipline (Enforced)

1. One concern per PR, one rollback unit.
2. No opportunistic refactor outside phase scope.
3. No new user-visible surface-specific auth branches.
4. Every PR must include:
- environment used (`local` or `cloud-dev`)
- flow exercised
- deterministic pass/fail evidence
- relevant trace ids
5. Phase advancement requires explicit owner signoff from affected services.

Anti-drift rule:
- If code diverges from canonical contract, fix code and docs in same change window.

---

## Acceptance Gates (System-Level)

All must pass in cloud-dev:
1. Prague signup lands with active session and usable account context.
2. MiniBob publish signup lands with continuity in Roma Bob.
3. Existing-user signin preserves `next`.
4. No access/refresh token appears in URL.
5. Replay test on same `finishId`: one success + deterministic replay failure.
6. Duplicate startup requests converge (no duplicate account/handoff durable state).
7. Cookie/domain/proto stable across canonical auth chain.
8. Venice embed path serves correct fresh/cached published revision from Tokyo without Paris runtime dependency.
9. Legacy conflict paths removed within compatibility window.
10. User-facing flow is one simple app experience.

---

## Minimal Observability

1. Propagate `x-ck-auth-trace-id` across startup path (Roma -> Berlin -> Roma -> Paris).
2. Log phases: start, callback, finish, ensure-account, handoff, final-route.
3. For Venice/Tokyo path, log published revision id and artifact resolution status.

Minimal fields:
- `traceId`
- `phase`
- `result`
- `reasonKey` (on fail)
- `revisionId` (embed/artifact path)

No platform-observability project in this PRD.

---

## Done Definition

PRD 56 is done when:
1. Berlin acts as strict AuthN gatekeeper and canonical finish handoff is stable.
2. Once user is in, startup services do not re-challenge core auth truth.
3. Signup A, Signup B, and Sign-in are reliable and deterministic.
4. Venice/Tokyo embed/artifact path is deterministic and does only its bounded job.
5. Legacy cross-service conflict paths are removed.
6. Product behaves as one simple web app experience.

---

## Execution Annex A — Normative Priority and Decision Order

This annex is normative for implementation. If any section conflicts with narrative wording above, this annex wins.

Priority order during execution:
1. Top Tenets (single app, Berlin gatekeeper, non-interference).
2. Product Contract (`user is in` definition).
3. Service Boundary Contract.
4. Canonical Auth Journey and Route Contracts.
5. Persistence/Idempotency Contract.
6. Phase gates and acceptance gates.

Decision rule:
- If an implementation choice introduces a second truth for the same job, reject it.
- If an implementation choice adds user-visible surface-specific auth behavior, reject it.

---

## Execution Annex B — Canonical State Machine (Auth and Startup)

### States
1. `ANON` — no active product session.
2. `AUTH_STARTED` — Roma started provider auth in Berlin.
3. `PROVIDER_CALLBACK_OK` — Berlin validated provider callback.
4. `FINISH_PENDING` — Berlin issued `finishId`, Roma finish not yet redeemed.
5. `SESSION_ESTABLISHED` — Roma redeemed finish and set session cookies.
6. `ACCOUNT_CONTEXT_READY` — Roma ensured account + entitlements context.
7. `HANDOFF_RESOLVED` — handoff claimed or deterministically resolved (if present).
8. `IN_PRODUCT` — user routed to final destination.

### Allowed transitions
1. `ANON -> AUTH_STARTED` (Roma auth start)
2. `AUTH_STARTED -> PROVIDER_CALLBACK_OK` (Berlin callback)
3. `PROVIDER_CALLBACK_OK -> FINISH_PENDING` (Berlin redirect with `finishId`)
4. `FINISH_PENDING -> SESSION_ESTABLISHED` (Roma `POST /auth/finish` success)
5. `SESSION_ESTABLISHED -> ACCOUNT_CONTEXT_READY` (Paris ensure-account success)
6. `ACCOUNT_CONTEXT_READY -> HANDOFF_RESOLVED` (if handoff present)
7. `HANDOFF_RESOLVED -> IN_PRODUCT`
8. `ACCOUNT_CONTEXT_READY -> IN_PRODUCT` (no handoff)

### Failure transitions
1. Any failure before `SESSION_ESTABLISHED` routes to login with deterministic auth reason.
2. Failure after `SESSION_ESTABLISHED` must preserve session and route via recovery-safe path.
3. A failure may not force auth restart unless auth is actually invalid.

### Forbidden transitions
1. `PROVIDER_CALLBACK_OK -> IN_PRODUCT` directly.
2. `SESSION_ESTABLISHED -> ANON` on provisioning/handoff transient errors.
3. Any client-only transition controlling critical completion.

---

## Execution Annex C — Endpoint-Level Contracts (Normative)

### Berlin: `POST /auth/login/provider/start`
Request JSON:
```json
{
  "provider": "google",
  "intent": "signin | signup_prague | signup_minibob_publish",
  "next": "/home",
  "handoffId": "mbh_xxx"
}
```
Rules:
1. `provider` required and in allowed provider list.
2. `intent` required and in enum.
3. `next` optional, normalized to absolute-app path (`/...`) and default `/home`.
4. `handoffId` optional; required only for `signup_minibob_publish`.
5. Berlin stores transaction state (`stateId`) with `intent/next/handoffId`.

Success response:
```json
{
  "ok": true,
  "provider": "google",
  "url": "https://...provider...",
  "expiresAt": "ISO-8601"
}
```

Failure classes:
1. provider invalid/not enabled -> 422.
2. config missing -> 503.
3. unexpected -> 500.

### Berlin: `GET /auth/login/provider/callback`
Input query:
- Provider protocol params (`code`, `state`, optional provider error fields).

Behavior:
1. Validate `stateId` and transaction.
2. Exchange provider code (via Supabase OAuth broker path).
3. Create one-time `finishId` record with short TTL.
4. Redirect to Roma `GET /api/session/finish?finishId=...`.

Required redirect behavior:
1. Never return session tokens in callback response body or URL.
2. Only opaque `finishId` appears in redirect query.

### Berlin: `POST /auth/finish`
Request JSON:
```json
{
  "finishId": "opaque_id"
}
```

Behavior:
1. Atomically consume `finishId`.
2. If valid, issue Berlin access/refresh session tokens.
3. Return token bundle to Roma server.

Success response:
```json
{
  "ok": true,
  "accessToken": "...",
  "refreshToken": "...",
  "accessTokenMaxAge": 900,
  "refreshTokenMaxAge": 2592000,
  "subject": {
    "userId": "uuid"
  }
}
```

Deterministic failures:
1. invalid/malformed -> 422
2. expired -> 410
3. replay/consumed -> 409
4. unavailable -> 503

### Roma: `GET /api/session/finish`
Input:
- Query: `finishId`

Required algorithm (must run server-side in one handler):
1. Validate `finishId` shape.
2. Call Berlin `POST /auth/finish`.
3. If finish fails with auth-class failure -> redirect `/login?error=...`.
4. Set session cookies.
5. Resolve startup intent from server-owned continuation state.
6. Call Paris ensure-account idempotently.
7. If `handoffId` present, call Paris handoff complete idempotently.
8. Compute deterministic final route.
9. Redirect user.

Forbidden in this route:
1. client-side follow-up requirement for critical completion.
2. writing auth cookies from any other route in canonical flow.

### Paris: `POST /api/accounts` (ensure-account semantics in PRD 56)
Required behavior:
1. Input may be empty/minimal; endpoint ensures usable account context for subject.
2. Repeat requests must converge to same logical result.
3. Must return deterministic payload including account identity used by Roma bootstrap context.

### Paris: `POST /api/minibob/handoff/complete`
Required behavior:
1. Input includes `handoffId`, `accountId`, `Idempotency-Key`.
2. Repeat requests with same idempotency key replay same logical result.
3. A consumed handoff for same subject/account must replay as success.
4. A consumed handoff for different subject/account must return deterministic conflict.

---

## Execution Annex D — Data Contracts and Consume-Once Requirements

### Berlin ticket record contract (Durable Object authoritative)
Ticket store owner: `BERLIN_AUTH_TICKETS` Durable Object.

Required stored fields:
1. `kind` (`state` or `finish`)
2. `payload` (ticket payload)
3. `expiresAt` (unix seconds)
4. `consumedAt` (unix seconds, nullable)
5. `consumeOutcome` (`consumed` or `expired`, nullable)
6. `cleanupAt` (unix seconds, marker retention cutoff)

Required behavior:
1. Single-ticket consume is atomic inside the owning Durable Object instance.
2. First valid consume returns payload and marks consumed.
3. Subsequent consume returns deterministic replay class (`alreadyConsumed`).
4. Expired first consume marks expired and returns deterministic expiry class (`expired`).
5. Missing/malformed maps to deterministic invalid class at Berlin route layer (`422`).

### Atomic consume semantics (required)
Equivalent behavior:
1. Read current ticket record.
2. If missing -> `missing`.
3. If already consumed:
- `consumeOutcome=expired` -> `expired`
- otherwise -> `alreadyConsumed`
4. If `expiresAt <= now`:
- set `consumedAt=now`, `consumeOutcome=expired`, extend `cleanupAt`
- return `expired`
5. Otherwise:
- set `consumedAt=now`, `consumeOutcome=consumed`, extend `cleanupAt`
- return `ok` with original payload

### Paris ensure-account invariants (required)
1. Subject/account relation uniqueness must be DB-enforced.
2. Ensure-account operation must be UPSERT-equivalent.
3. Idempotency record should replay same payload for same idempotency key and subject.

### Paris handoff invariants (required)
1. One handoff can be consumed once logically.
2. Same subject/account replay -> same success payload.
3. Different subject/account replay -> deterministic conflict.

---

## Execution Annex E — Error Taxonomy (Normative)

| Class | Owner | HTTP | Reason Key Pattern | User Routing |
|---|---|---|---|---|
| Provider denied | Berlin | 401 | `coreui.errors.auth.provider.denied` | `/login?error=...` |
| Invalid callback | Berlin | 422 | `coreui.errors.auth.provider.invalidCallback` | `/login?error=...` |
| Finish expired | Berlin | 410 | `coreui.errors.auth.finish.invalidOrExpired` | `/login?error=...` |
| Finish replay | Berlin | 409 | `coreui.errors.auth.finish.invalidOrExpired` | `/login?error=...` |
| Auth unavailable | Berlin | 503 | `coreui.errors.auth.unavailable` | `/login?error=...` |
| Account ensure transient fail | Paris/Roma | 5xx | service-specific | recovery-safe authenticated path |
| Handoff terminal conflict | Paris/Roma | 409 | handoff-specific | `/home?handoffError=...` |
| Embed artifact unavailable | Venice/Tokyo | 404/503 | render-specific | deterministic embed unavailable response |

Rules:
1. Auth-class failures before session establishment go to login.
2. Domain-class failures after session establishment do not clear valid session by default.

---

## Execution Annex F — Cloud-Dev Rollout Runbook (Day-by-Day)

### Day 0 (pre-rollout)
1. Confirm Berlin callback URL points to Berlin callback route.
2. Confirm Roma finish route deployed and reachable.
3. Confirm Paris ensure-account and handoff endpoints healthy.
4. Confirm observability fields present in logs.

### Day 1 (Phase 1 rollout)
1. Roll Berlin callback->finish behavior behind deployment boundary.
2. Validate replay tests and token leakage checks.
3. Block Phase 2 if any auth-loop regression appears.

### Day 2-3 (Phase 2 rollout)
1. Route canonical completions through Roma finish handler.
2. Remove client critical completion dependencies.
3. Validate signup/signin journey stability and cookie matrix.

### Day 4-5 (Phase 3 rollout)
1. Validate idempotency convergence under repeated requests.
2. Confirm no duplicate durable outcomes in Paris.

### Day 6-7 (Phase 5 hard-cut window)
1. Remove temporary compatibility aliases.
2. Remove legacy callback/cookie continuation code.
3. Re-run full acceptance suite.

Stop conditions (any day):
1. token leakage in URL.
2. deterministic replay behavior broken.
3. user-facing auth loop increase.

---

## Execution Annex G — Phase Evidence Checklists

### Phase 1 evidence
1. Successful trace for callback->finish.
2. Replay trace showing one success + one replay failure.
3. URL capture proving no access/refresh tokens in URL.

### Phase 2 evidence
1. Trace proving Roma finish sets cookies.
2. Trace proving account ensure runs server-side.
3. Trace proving handoff completion runs server-side when applicable.

### Phase 3 evidence
1. Parallel request test results for ensure-account.
2. Parallel request test results for handoff completion.
3. DB assertions: no duplicate durable entities.

### Phase 4 evidence
1. Venice request trace with Tokyo artifact resolution only.
2. Embed behavior stable when Paris runtime intentionally unavailable.

### Phase 5 evidence
1. Removed route list (legacy paths gone).
2. Route probe proving canonical paths only.
3. 2026-03-05 (local): removed legacy Roma OAuth callback alias route file:
   - `roma/app/api/session/login/google/callback/route.ts`
4. 2026-03-05 (local): verified no source references remain to `/api/session/login/google/callback`.

---

## Execution Annex H — Test Matrix (Must Pass)

### Auth path tests
1. `AUTH-001` signup prague happy path.
2. `AUTH-002` signup minibob publish happy path.
3. `AUTH-003` signin happy path.
4. `AUTH-004` provider denied.
5. `AUTH-005` invalid callback state.
6. `AUTH-006` finish expired.
7. `AUTH-007` finish replay.
8. `AUTH-008` auth unavailable.
9. `AUTH-009` no token in URL assertion.
10. `AUTH-010` callback->finish redirect correctness.

### Startup convergence tests
11. `START-001` ensure-account idempotent replay.
12. `START-002` handoff complete idempotent replay same subject/account.
13. `START-003` handoff conflict different subject/account.
14. `START-004` browser refresh during finish does not orphan completion.
15. `START-005` half-state recovery route.

### Cookie/domain tests
16. `COOKIE-001` cookie attributes exactness.
17. `COOKIE-002` domain behavior across cloud-dev hosts.
18. `COOKIE-003` refresh cycle stability after worker restart.

### Cross-service non-interference tests
19. `BOUND-001` Bob does not perform critical auth completion.
20. `BOUND-002` Berlin does not call provisioning path.
21. `BOUND-003` Venice embed path does not call Paris.
22. `BOUND-004` Tokyo-worker replayed jobs are idempotent.

### Legacy removal tests
23. `LEGACY-001` legacy callback path removed.
24. `LEGACY-002` legacy cookie continuation removed.
25. `LEGACY-003` temporary aliases removed within window.

---

## Execution Annex I — Explicitly Prohibited Patterns

1. Client-side `useEffect` as critical startup completion step.
2. Multiple services writing auth cookies for canonical flow.
3. Berlin provisioning side-effects.
4. Paris/provider OAuth logic.
5. Venice runtime calls to Paris for embed request path.
6. Indefinite compatibility aliases.
7. Silent fallback branches that bypass canonical contracts.
8. Adding new surface-specific auth semantics in this PRD.

---

## Execution Annex J — Change Control and Signoff

Required signoff records per phase:
1. Berlin owner: callback/finish/session correctness.
2. Roma owner: finish orchestration + cookie/session behavior.
3. Paris owner: ensure-account/handoff idempotency correctness.
4. Venice/Tokyo owner (Phase 4+): embed/artifact non-interference correctness.

Signoff artifact format:
1. Phase id.
2. Date/time (UTC).
3. Environment (`cloud-dev`).
4. Trace ids.
5. Gate result (`pass`/`fail`) with reason.

No phase may be marked complete without recorded signoff artifacts.

---

## Execution Annex K — Drift Prevention During Implementation

1. Every PR must include a "Contract Delta" section:
- intended contract touched
- unchanged contracts explicitly listed

2. If a team discovers hidden coupling:
- do not patch around it silently
- raise explicit contract violation note in PR and fix at boundary

3. Documentation freshness rule:
- route/contract change without matching PRD update is a P0 doc bug
- must be fixed in same merge window

---

## Execution Annex L — Roma Finish Migration Matrix (Normative)

This annex defines exact Roma route migration so execution does not improvise.

### Route ownership during rollout

| Route | Pre-PRD behavior | Phase 1 | Phase 2 | Phase 3 | Final |
|---|---|---|---|---|---|
| `GET /api/session/login/google` | Starts OAuth and writes `ck-roma-login-next` cookie | Starts OAuth using Berlin server-owned continuation payload; stop writing continuation cookie | canonical start | canonical start | canonical start |
| `GET /api/session/login/google/callback` | Receives provider callback and proxies to Berlin callback, sets cookies, redirects to post-login | compatibility alias only (pass-through to Berlin callback) | compatibility alias only | removed | removed |
| `GET /api/session/post-login` | runs bootstrap check after cookie set | retained for password-login compatibility only | retained for password-login compatibility only | merged into shared startup finalizer or removed if password flow converged | either removed or password-only alias to shared finalizer |
| `GET /api/session/finish` | not canonical in old flow | introduced; optional path in phase 1 smoke | canonical completion gate | canonical completion gate | canonical completion gate |

### Required migration wiring

1. Provider callback target must be Berlin callback.
2. Berlin callback redirect target must be Roma finish route.
3. Roma callback route (legacy) may only proxy and may not set canonical session state.
4. Roma finish route becomes the only OAuth completion writer of auth cookies.

### Canonical Roma finish handler sequence (must be exact)

1. Parse `finishId` from query.
2. Call Berlin `POST /auth/finish`.
3. On auth-class failure: redirect to `/login?error=...`.
4. Set cookies from finish response.
5. Resolve continuation state from finish response (`intent`, `next`, `handoffId`).
6. Execute ensure-account server-side.
7. If `handoffId` exists, execute handoff complete server-side.
8. Determine final route deterministically.
9. Redirect.

### Forbidden Roma finish behavior

1. Reading continuation from `ck-roma-login-next` cookie.
2. Deferring ensure-account/handoff completion to client-side hooks.
3. Clearing valid session due to non-auth startup failures.

---

## Execution Annex M — Bootstrap Convergence and De-duplication

### Problem being removed

Current startup performs bootstrap twice (server layout and client fetch). This is internal re-challenge drift.

### Converged contract

1. Canonical startup bootstrap executes once on server path for initial render.
2. Client hydration consumes server bootstrap payload; no immediate duplicate bootstrap fetch on mount.
3. Client may re-fetch bootstrap only on explicit invalidation events:
- account switch
- explicit user refresh action
- membership mutation event

### Read-only bootstrap requirement

By end of Phase 3:
1. `/api/roma/bootstrap` is read-only.
2. Auto-provision side-effect is removed from bootstrap path.
3. Provision/ensure-account occurs only in explicit startup orchestration paths (`/api/session/finish` and recovery handler).

### Transitional handling for pre-cutover sessions

If bootstrap resolves session but no account context:
1. Return deterministic no-account signal.
2. Roma recovery server path executes ensure-account idempotently.
3. Retry bootstrap once server-side.
4. If still missing, return deterministic recovery error route.

No silent bootstrap auto-provision fallback allowed after convergence cut.

---

## Execution Annex N — Berlin Data and Config Migration Plan

### N1. Ticket storage migration (KV -> Durable Object authoritative)

1. Deploy Durable Object class + binding for `BERLIN_AUTH_TICKETS`.
2. Berlin writes new `stateId` and `finishId` tickets to Durable Object immediately after deployment gate opens.
3. During compatibility window, Berlin may read KV only for in-flight pre-cutover states.
4. After window closes, KV state reads for auth tickets are removed.

### N2. Berlin ticket-store connectivity contract

Berlin requires an authoritative ticket store binding for write/consume of one-time tickets.

Required Berlin env/bindings:
1. `BERLIN_AUTH_TICKETS` Durable Object binding
2. existing session/JWT vars

Fail-fast:
- Berlin must fail auth ticket operations deterministically (`503`) when ticket-store dependencies are missing.

### N3. Callback configuration migration

Current state uses Roma callback URL in `BERLIN_LOGIN_CALLBACK_URL`.

Target state:
1. Provider callback URL points to Berlin callback route only.
2. Berlin has explicit Roma finish redirect base variable (example: `ROMA_FINISH_URL_BASE`) or equivalent deterministic config.
3. Supabase Google OAuth redirect whitelist includes Berlin callback URL.
4. Legacy Roma callback URL removed from provider whitelist at hard-cut.

### N4. Cutover safety

1. Deploy Berlin callback+finish support first.
2. Validate callback chain in cloud-dev with trace evidence.
3. Only then move Roma canonical path and remove legacy callback.

---

## Execution Annex O — Continuation State Transport Contract (`next` and `handoffId`)

### Target model

Continuation state is server-owned in Berlin transaction records and finish records.

### Required payload contracts

`POST /auth/login/provider/start` request includes:
1. `intent`
2. normalized `next`
3. optional `handoffId`

`POST /auth/finish` response includes continuation object:
```json
{
  "continuation": {
    "intent": "signin | signup_prague | signup_minibob_publish",
    "next": "/home",
    "handoffId": "mbh_xxx"
  }
}
```

### Migration requirements

1. Stop writing `ck-roma-login-next` cookie in Roma start route by end of Phase 1.
2. Roma finish route must consume continuation from finish response only.
3. Remove all dependencies on login-next cookie in OAuth flow at hard-cut.

---

## Execution Annex P — Cookie Domain Matrix (Explicit Values)

This matrix is normative unless a new PRD supersedes it.

1. Local (`localhost`/`127.0.0.1`)
- Domain: unset (host-scoped)
- Secure: false on `http`, true on `https`

2. Cloud-dev (`*.dev.clickeen.com`)
- Domain: `.dev.clickeen.com`
- Secure: true

3. Production (`app.clickeen.com` current topology)
- Domain: unset (host-scoped to app host)
- Secure: true

Global cookie attributes:
- `HttpOnly`
- `SameSite=Lax`
- path `/`

Change control:
- Any cookie matrix change requires explicit PRD addendum and migration plan.

---

## Execution Annex Q — Existing Session Compatibility Invariant

During PRD 56 rollout:
1. Existing valid Berlin sessions (minted via pre-cutover callback path) must continue to refresh/logout.
2. No forced global logout is allowed for this PRD.
3. New login attempts use canonical finish path.
4. Legacy session invalidation occurs only by normal expiration/revocation policy.

Verification:
1. Pre-cutover session refresh works after Phase 2 deploy.
2. Logout works for pre-cutover and post-cutover sessions.

---

## Execution Annex R — Venice Phase Deliverable (Not Vague)

Phase 4 deliverable must be concrete:

1. One code-level assertion/probe proving Venice embed request path resolves only via Tokyo artifact URLs.
2. One cloud-dev runtime test proving embeds still resolve when Paris runtime is intentionally unavailable.
3. One short architecture note documenting Venice dependency graph for embed path.

If these pass with no code changes:
- Phase 4 may close with confirmation-only change set.

If these fail:
- Only boundary-hardening fixes allowed in Venice for this PRD.

---

## Execution Annex S — Login Error Mapping Contract

Roma login UX must explicitly map and render at least:
1. `coreui.errors.auth.provider.denied`
2. `coreui.errors.auth.provider.invalidCallback`
3. `coreui.errors.auth.finish.invalidOrExpired`
4. `coreui.errors.auth.unavailable`
5. `coreui.errors.auth.required`
6. `coreui.errors.auth.login_failed`

Rules:
1. Unknown reason key falls back to safe generic login failure message.
2. Error messages must not leak provider tokens or internal diagnostics.
3. Mapping updates are required in same PR as new auth reason keys.

---

## Execution Annex T — Deprecation Sequence (Exact)

### T1. Deprecate
1. Roma callback route OAuth completion responsibilities.
2. `ck-roma-login-next` continuation cookie in OAuth path.
3. Bootstrap auto-provision side-effects.
4. Client-side handoff completion as critical startup path.

### T2. Remove (hard-cut)
1. Legacy callback completion code.
2. Legacy continuation cookie reads/writes in OAuth path.
3. Duplicate startup completion paths.

### T3. Completion criteria
- No deprecated behavior reachable from canonical user journeys.
- Route probes show canonical-only behavior.

---

## Execution Annex U — Under-Specified Areas Closure Checklist

This checklist must be marked complete before Phase 1 code merge:

1. Roma finish handler sequence documented in code comments and PR checklist.
2. Callback alias lifecycle documented with removal date.
3. Post-login route fate documented (password-only alias or removal).
4. Bootstrap side-effect removal plan documented with exact phase.
5. Berlin ticket schema migration file created and referenced.
6. Berlin callback/finish env migration steps documented.
7. Continuation payload schema (`next`/`handoffId`) finalized.
8. Cookie matrix values confirmed against runtime code.
9. Existing session compatibility tests listed and assigned.
10. Venice Phase 4 confirmation artifacts pre-defined.
11. Login error mapping table updated and linked to tests.

PRD 56 execution cannot start until checklist items have owners.

---

## Execution Annex V — Strict Service Execution Checklists (Berlin, Roma, Paris)

This annex converts PRD 56 into a no-ambiguity execution checklist.
Each item is normative. "Checked" means implementation exists, tests pass, and evidence is attached in PR notes.

Execution environment policy:
1. Primary truth environment for rollout gates is cloud-dev.
2. Local environment is allowed for fast feedback, but does not replace cloud-dev gates.
3. Every checklist item must declare where it was validated: `local`, `cloud-dev`, or both.

Global sequencing policy:
1. Berlin checklist gates must pass before Roma consumes new finish contracts.
2. Roma checklist gates must pass before Paris legacy provisioning side-effects are hard-cut.
3. Paris checklist gates must pass before legacy aliases are removed.
4. Phase 5 hard-cut cannot begin until Berlin + Roma + Paris gates are green in cloud-dev for two consecutive days.

### V1 — Berlin Execution Checklist (AuthN and session lifecycle only)

#### B0. Contract freeze (must complete first)
1. [ ] Confirm Berlin owns provider OAuth start/callback and finish-token issuance/redemption.
2. [ ] Confirm Berlin does not own account provisioning or entitlement policy.
3. [ ] Confirm "no access/refresh tokens in URL" rule is explicit in code comments on start/callback/finish handlers.
4. [ ] Confirm callback chain is provider -> Berlin callback -> Roma finish.

#### B1. Data/store implementation
1. [ ] Deploy and bind `BERLIN_AUTH_TICKETS` as authoritative consume-once store for `stateId` and `finishId`.
2. [ ] Enforce consume-once atomicity with Durable Object consume semantics from Annex D.
3. [ ] Enforce TTL and consumed-at invariants for all one-time tickets.
4. [ ] Remove KV from consume-once authority path for `stateId` and `finishId`.

#### B2. Endpoint implementation
1. [ ] Implement `POST /auth/login/provider/start` with exact request schema:
`provider`, `intent`, `next`, optional `handoffId`.
2. [ ] Persist continuation context (`intent`, `next`, `handoffId`) server-side with `stateId`.
3. [ ] Implement `GET /auth/login/provider/callback` to consume `stateId`, mint `finishId`, and redirect browser to Roma finish route.
4. [ ] Implement `POST /auth/finish` to atomically consume `finishId`, issue session payload, and return continuation context.
5. [ ] Ensure `POST /auth/finish` returns deterministic error reasons from Annex E.

#### B3. Config/callback migration
1. [ ] Update Berlin environment contract so provider callback URI points to Berlin callback endpoint.
2. [ ] Update Supabase/Google redirect whitelist to include Berlin callback URI in local + cloud-dev.
3. [ ] Define and validate Berlin -> Roma finish redirect URL contract for local + cloud-dev.
4. [ ] Add fail-fast startup checks: missing callback/redirect env must prevent service startup.

#### B4. Observability and diagnostics
1. [ ] Generate and propagate `x-ck-auth-trace-id` across start, callback, finish.
2. [ ] Emit structured logs for each auth transition with trace id, intent, provider, and outcome.
3. [ ] Ensure logs never include provider auth codes, access tokens, or refresh tokens.
4. [ ] Add replay/expiry counters for `stateId` and `finishId` failures.

#### B5. Berlin hard gates (must pass in cloud-dev)
1. [ ] Replay test: second consume of same `stateId` fails deterministically.
2. [ ] Replay test: second consume of same `finishId` fails deterministically.
3. [ ] Expiry test: expired `finishId` returns mapped reason and safe redirect behavior.
4. [ ] Provider deny/cancel test returns mapped reason and never creates session.
5. [ ] Legacy callback alias test routes to canonical callback and emits deprecation log.

#### B6. Berlin stop conditions
1. [ ] Stop rollout if callback URL mismatch appears in logs for any environment.
2. [ ] Stop rollout if consume-once replay appears as intermittent success.
3. [ ] Stop rollout if any token appears in URL/query, logs, or analytics payloads.

### V2 — Roma Execution Checklist (single startup orchestrator)

#### R0. Contract freeze (must complete first)
1. [ ] Confirm Roma owns browser-facing orchestration after Berlin callback.
2. [ ] Confirm Roma owns cookie set/clear for Roma domain policy only.
3. [ ] Confirm Roma finish handler is the only canonical OAuth completion path.
4. [ ] Confirm legacy callback and post-login routes are aliases or removed per Annex L/T.

#### R1. Finish handler implementation (`GET /api/session/finish`)
1. [ ] Redeem `finishId` server-to-server via Berlin `POST /auth/finish`.
2. [ ] Set Roma session cookies using Annex P matrix.
3. [ ] Execute account ensure step via Paris canonical endpoint contract.
4. [ ] Execute handoff completion when continuation includes `handoffId`.
5. [ ] Redirect to continuation `next` when present; otherwise use default authenticated landing.

#### R2. Failure/recovery implementation
1. [ ] Map all Annex E reason keys to login UX keys from Annex S.
2. [ ] On Berlin finish failure, redirect to `/login?error=<reason>` without leaking internals.
3. [ ] On Paris ensure-account failure after session success, route user to recovery-safe surface.
4. [ ] Implement retry-safe server-side recovery for "authenticated but not provisioned" users.

#### R3. Startup convergence and de-duplication
1. [ ] Remove duplicate bootstrap execution pattern (server + client double fetch).
2. [ ] Keep one canonical bootstrap read path for authenticated runtime.
3. [ ] Ensure client consumes hydrated bootstrap/account context instead of immediately re-fetching.
4. [ ] Remove OAuth continuation cookie (`ck-roma-login-next`) read/write from canonical flow.

#### R4. Route migration and alias discipline
1. [ ] Keep legacy callback route as compatibility alias only during migration window.
2. [ ] Keep post-login route only if required for non-OAuth paths; document exact scope.
3. [ ] Emit deprecation logs on alias usage with trace id and source route.
4. [ ] Remove aliases on schedule from Annex T after adoption gates are met.

#### R5. Roma hard gates (must pass in cloud-dev)
1. [ ] Flow A: Prague create-account lands in Roma with session + account ready.
2. [ ] Flow B: Prague publish signup lands in Roma with session + same widget context loaded.
3. [ ] Flow C: Sign-in lands in Roma authenticated with no bootstrap race artifacts.
4. [ ] Refresh and logout behavior remains valid for pre-cutover sessions.
5. [ ] Login page correctly renders all mapped error keys plus unknown fallback.

#### R6. Roma stop conditions
1. [ ] Stop rollout if bootstrap executes twice on fresh authenticated page load.
2. [ ] Stop rollout if continuation depends on client-side cookie for critical auth completion.
3. [ ] Stop rollout if post-login and finish paths both mutate startup state in parallel.

### V3 — Paris Execution Checklist (idempotent account/handoff semantics only)

#### P0. Contract freeze (must complete first)
1. [ ] Confirm Paris owns provisioning/AuthZ and never handles provider OAuth callbacks.
2. [ ] Confirm Paris exposes idempotent ensure-account and handoff-complete contracts.
3. [ ] Confirm bootstrap role is startup read model, not provisioning authority after cutover.

#### P1. Ensure-account implementation
1. [ ] Enforce idempotent ensure-account by user subject with single canonical account outcome.
2. [ ] Implement database-level uniqueness/UPSERT semantics to prevent duplicate accounts under retry.
3. [ ] Return deterministic responses for already-provisioned and newly-provisioned cases.
4. [ ] Ensure endpoint is safe under concurrent duplicate requests from retry behavior.

#### P2. Handoff completion implementation
1. [ ] Enforce one-time claim semantics for `handoffId` with subject binding.
2. [ ] Make handoff completion idempotent under repeated same-subject calls.
3. [ ] Reject cross-subject handoff claims deterministically.
4. [ ] Return canonical widget/project identifiers needed by Roma continuation.

#### P3. Bootstrap convergence
1. [ ] Remove bootstrap auto-provision side-effects per Phase 3 cutover plan.
2. [ ] Keep bootstrap read-only and deterministic for authenticated startup.
3. [ ] Provide explicit recovery response contract when user is authenticated but unprovisioned.

#### P4. Paris hard gates (must pass in cloud-dev)
1. [ ] Duplicate ensure-account requests do not create duplicate records.
2. [ ] Duplicate handoff completion requests do not duplicate ownership or mappings.
3. [ ] Bootstrap no longer creates account side-effects after Phase 3 cutover.
4. [ ] Authenticated-unprovisioned recovery contract is exercised and passes.

#### P5. Paris stop conditions
1. [ ] Stop rollout if duplicate account/workspace records appear for same auth subject.
2. [ ] Stop rollout if bootstrap still provisions accounts after cutover flag is enabled.
3. [ ] Stop rollout if handoff claim can succeed for wrong subject.

### V4 — Cross-Service Final Cutover Checklist (all services)

1. [ ] Canonical flow traces exist for Flow A/B/C with a single `x-ck-auth-trace-id` chain each.
2. [ ] Legacy aliases show <5% traffic for 48h, then are removed per Annex T.
3. [ ] No canonical flow relies on browser cookie continuation for `next`/`handoffId`.
4. [ ] No canonical flow contains access/refresh tokens in URL or log payloads.
5. [ ] Cloud-dev smoke tests pass for local and cloud-dev route/cookie matrices.
6. [ ] Rollback playbook exists and was dry-run before hard-cut.

Execution handoff rule:
1. Berlin, Roma, and Paris work cannot be marked complete by code merge alone.
2. Completion requires checklist item evidence + cloud-dev gate evidence + deprecation cleanup evidence.
