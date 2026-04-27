# 077 PRD - Berlin Auth Session And Internal Bridge Closure

Status: IN PROGRESS - CUT 6 STARTED AFTER CUT 5 CI GREEN
Owner: Berlin identity/session boundary, Roma account shell
Priority: P0
Date: 2026-04-26

Source:
- `Execution_Pipeline_Docs/01-Planning/berlin-auth-analysis-deep.md`
- `Execution_Pipeline_Docs/02-Executing/076__PRD__Berlin_Login_Signup_Product_Boundary_Closure.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- Runtime inspection of `berlin/src/*`, `roma/lib/michael-shared.ts`, and Roma session routes

---

## What This PRD Is About

Berlin's direct-provider login path is now the product path, but the session and internal bridge code still carries the old Supabase-Auth session model.

This PRD closes that seam.

The goal is not to add another abstraction layer. The goal is to name the surviving session truths, delete compatibility residue that is no longer product truth, and make the remaining residual bridge fail closed.

Target product chain:

`Roma -> Berlin -> Provider -> Berlin -> Roma`

Target account product chain:

`account opens Builder in Roma -> Bob edits one widget -> Roma saves to Tokyo`

Supabase/Michael remains persistence infrastructure. It must not be a browser-visible login owner, an implicit session-mode owner, or a silent fallback account authority.

---

## Decisions Required Before Execution

This PRD is not permission to start coding all cuts.

Cut 0 must answer the decisions below before any runtime change starts. If any answer is unknown, implementation stops there.

### Decision 1 - Old Sessions

Question:

Do we deliberately invalidate existing Berlin sessions that do not have explicit `authMode` and force re-login?

Recommended answer:

Yes. Clickeen is pre-GA, and preserving implicit old session state is exactly the kind of compatibility shim this cleanup is meant to remove.

Why it matters:

- If yes, implementation can reject session KV rows without `authMode` and keep the code simple.
- If no, implementation needs a migration/compatibility reader, which keeps the old implicit behavior alive longer.

### Decision 2 - Password Login

Question:

Is `POST /auth/login/password` still required for a real cloud-dev smoke or support workflow?

Recommended answer:

No. Delete the public Berlin route, Roma password API route, hidden Roma password UI, and the Supabase password grant path.

Why it matters:

- If deleted, `supabase_bridge` may become unnecessary after the Michael bridge cleanup.
- If retained, it must be local-only/internal-only and explicitly non-product.

### Decision 3 - Supabase Bridge Sessions

Question:

After password login is deleted or gated, does any real product path still need `supabase_bridge` sessions?

Recommended answer:

No, unless Cut 0 proves a live dependency.

Why it matters:

- If no, delete `supabase_bridge` session issuance and most of `ensureSupabaseAccessToken`.
- If yes, keep it as a named compatibility mode, but do not allow it to be inferred by token presence.

### Decision 4 - Direct-Provider Email Change

Question:

What should Roma/Berlin do when a Google/direct-provider user tries to change email?

Recommended answer:

Hide or disable the product affordance for now, and make the API return an explicit unsupported response for direct-provider sessions.

Why it matters:

- Direct-provider login email is provider-managed.
- A proper Clickeen-owned contact-email change flow is a separate product feature with verification rules.
- Keeping the current flow means direct-provider users hit a fake Supabase-dependent path.

### Decision 5 - Cloudflare Internal Auth Glue

Question:

Should this PRD require `CK_INTERNAL_SERVICE_JWT` in Cloudflare for Berlin/Roma product runtime?

Recommended answer:

No.

Do not add, require, or normalize `CK_INTERNAL_SERVICE_JWT` as Cloudflare product architecture.

Why it matters:

- A shared HTTP secret is local/dev glue, not a clean Cloudflare product boundary.
- The residual Roma -> Berlin -> Michael token bridge is a deletion/replacement target, not a surviving auth model.
- If Roma still needs Michael/PostgREST reads, those reads need a real owner such as a Berlin product endpoint, a Tokyo-owned API, or a Cloudflare-native private binding. They must not depend on a browser-reachable service-role-token broker.

Implication:

- Do not fix `/auth/michael/token` by making Cloudflare depend on `CK_INTERNAL_SERVICE_JWT`.
- Delete the marker-only fallback and service-role return path.
- Replace remaining Roma Michael bridge callers before deleting the route.
- Local tooling may still have a local-only secret, but it is not product truth and must not appear as a required Cloudflare runtime dependency.

### Decision 6 - Authz Capsule Caching

Question:

Do we cache bootstrap authz capsules in this PRD, or only parallelize reads and defer caching?

Decision:

Do not cache bootstrap authz capsules in this PRD.

Parallelize safe reads only.

Why it matters:

- No Berlin authz-cache means no stale cached permission ticket can survive a role/tier/account change.
- A user will not need to log in again because we skipped authz caching.
- Users need to log in again only when the Berlin session itself is invalid, expired, revoked, or intentionally invalidated by this cleanup.
- This cleanup is primarily a correctness/simplification PRD, not a latency PRD.

### Decision 7 - Route Table

Question:

Should route table cleanup ship in the same implementation pass?

Decision:

Yes, but only as a delete-and-rebuild step after the old auth paths are gone.

Why it matters:

- The router must be rebuilt from the surviving route list only.
- Do not reorganize dead password/V1/compat routes into a prettier router.
- Delete the wrong routes first, then build the clean route table.

---

## Product Truth

This PRD follows the product truth in `documentation/architecture/CONTEXT.md`.

1. Berlin owns identity-to-session truth.
2. Direct provider login is the canonical cloud path.
3. Roma owns account shell/bootstrap presentation and cookie redemption.
4. Bob owns in-memory widget editing only.
5. Product authz comes from Berlin's signed account authz capsule.
6. Michael/Supabase is persistence infrastructure, not the product identity owner.
7. Invalid auth/session state must fail at the named boundary.
8. Clickeen is pre-GA, so stale public compatibility shims are deletion targets unless explicitly required.

---

## Current Runtime Reality

### Good Existing Pieces To Preserve

- Google direct provider flow is already Berlin-owned.
- OAuth state and finish tickets use `BERLIN_AUTH_TICKETS` and are consume-once.
- Browser callback URLs carry only `finishId`, not session tokens.
- Berlin access tokens are signed by Berlin.
- Roma uses httpOnly shared cookies and resolves account bootstrap through Berlin.
- `login_identities` exists with a unique `(provider, provider_subject)` constraint.
- Account bootstrap fails explicitly when canonical profile/account state is missing.

### Wrong Existing Pieces To Fix Or Delete

1. `SessionState` has optional Supabase fields but no explicit auth-mode discriminator.
2. Password login creates a Supabase-bridge session; direct Google login creates a different session shape with the same type.
3. `handleMeEmailChange` assumes a Supabase refresh token exists and fails for direct-provider sessions.
4. `handleMichaelToken` branches on `supabaseRefreshToken` presence and may return a Supabase service-role key to a Roma-marked server request.
5. If `CK_INTERNAL_SERVICE_JWT` is missing, Berlin accepts a heuristic "server-shaped" request instead of failing closed.
6. Refresh-token V1 compatibility still accepts client-visible `supabaseRefreshToken` payloads and can recreate KV session state.
7. First login still uses an app-level race handler around `login_identities` instead of a DB-owned upsert/returning boundary.
8. Bootstrap performs independent reads sequentially and signs a new authz capsule every time.
9. `account-state.ts` and `account-reconcile.ts` duplicate profile row and location normalization logic.
10. Several write handlers re-run the full account-state load after writes.
11. Public password login remains live in Berlin dispatch even though it is only documented as smoke/compatibility.
12. Route dispatch is a long linear chain of path string checks and regexes.

---

## Non-Goals

This PRD does not move all residual account-management routes out of Berlin. That is a separate boundary extraction.

This PRD does not add a new general auth framework.

This PRD does not introduce a new customer-facing password login product.

This PRD does not make Supabase Auth a product identity owner again.

This PRD does not build a full verified-email contact-method product unless explicitly added later. Email-change behavior must become clean and explicit, not silently broken.

---

## Surviving Authorities

- Berlin owns provider identity, login identity mapping, session issuance, refresh rotation, and bootstrap authz capsule.
- `login_identities` owns provider linkage.
- `user_profiles.user_id` is the Clickeen user id.
- `SessionState.authMode` owns which session model is active.
- Roma owns cookie redemption and account-shell access to Berlin bootstrap.
- Residual Roma -> Berlin -> Michael token brokering has no surviving product owner in this PRD. It must be deleted or replaced by owned product APIs/private bindings.
- No code may infer session mode from "does this optional token happen to exist?"

---

## Required Target State

### Session State

`SessionState` must contain an explicit discriminator.

```ts
type AuthMode = 'direct_provider' | 'supabase_bridge';

type BaseSessionState = {
  sid: string;
  currentRti: string;
  rtiRotatedAt: number;
  userId: string;
  ver: number;
  revoked: boolean;
  authMode: AuthMode;
  createdAt: number;
  updatedAt: number;
};

type DirectProviderSessionState = BaseSessionState & {
  authMode: 'direct_provider';
};

type SupabaseBridgeSessionState = BaseSessionState & {
  authMode: 'supabase_bridge';
  supabaseRefreshToken: string;
  supabaseSubject: string;
  supabaseAccessToken?: string;
  supabaseAccessExp?: number;
};
```

The exact TypeScript shape may differ, but these invariants are required:

- `authMode` is always present on valid session state.
- Supabase tokens are legal only on `supabase_bridge`.
- Direct-provider sessions must not carry Supabase refresh tokens.
- Supabase-bridge features must branch on `authMode`, not optional-token presence.
- Missing or malformed `authMode` is invalid session state after this PRD.

### Internal Michael Token Bridge

`GET /auth/michael/token` must stop being a Cloudflare product dependency.

Required behavior:

- No browser-reachable Berlin route may hand Roma a Supabase service-role token.
- No Cloudflare product path may rely on `CK_INTERNAL_SERVICE_JWT` to make that broker acceptable.
- Any remaining `supabase_bridge` path may return a refreshed Supabase user access token only when session state is internally valid and the session explicitly says `authMode: 'supabase_bridge'`.
- Direct-provider sessions must not receive a Michael service-role token from this route.
- Existing Roma server call sites must move to a named surviving owner before the service-role branch is deleted.
- Marker-only trust and browser-header heuristics must be deleted.

### Email Change

Provider login email is provider-managed. Clickeen must not pretend it can mutate Google identity email through Supabase Auth.

Required behavior:

- Direct-provider sessions must not call `ensureSupabaseAccessToken` for email change.
- Until a verified product contact-email flow exists, `/v1/me/email-change` must return a clean explicit unsupported response for direct-provider sessions.
- Roma must not present a broken email-change affordance as if it works for direct-provider sessions.
- If Supabase-bridge sessions survive for local smoke only, their email-change behavior must be explicitly marked compat-only.

### Password Login

Password login must no longer be a silent public product route.

Preferred target:

- Delete Berlin public password login route.
- Delete Roma same-origin password login route and hidden password UI.
- Replace smoke flows with direct-provider test coverage or an explicit local-only internal fixture.

Fallback target only if a verified smoke dependency exists:

- Gate password login behind an explicit non-product env flag.
- Allow it only in `ENV_STAGE=local` or a named smoke environment.
- Document that it produces `supabase_bridge` sessions and is not a customer login surface.
- It must not be enabled in cloud-dev customer routes by accident.

### Refresh Tokens

V1 refresh compatibility must be deleted.

Required behavior:

- Remove `RefreshPayloadV1`.
- Remove `payload.v === 1` reconstitution from `handleRefresh`.
- `verifyRefreshToken` accepts only the current refresh payload shape.
- Old refresh tokens fail auth-required and force normal login.
- Session-state prefix/version may be bumped to intentionally invalidate old sessions rather than preserving multi-version compatibility.

### First Login Identity Reconciliation

The database must own the `(provider, provider_subject)` race.

Required behavior:

- Use one database-owned upsert/returning boundary to resolve the winning `user_id`.
- Remove the app-level optimistic insert, conflict reread, retry, and second profile write loop.
- Concurrent first logins for the same provider identity must converge to one user profile and one login identity.

### Bootstrap

Bootstrap must remain read-only and fail-fast, but it should stop doing unnecessary serialized work.

Required behavior:

- Independent reads are parallelized where safe.
- Authz capsule signing may be cached only after the authz version is stable and includes every signed input that affects authorization or capsule identity.
- Do not cache on `account_members.created_at` alone. Role, tier, status, account identity fields, and signing key id must be part of the cache identity or represented by a reliable updated version.

---

## Execution Rules

Each cut below has a green gate. Do not move to the next cut until the current gate is green.

Do not start implementation until the decisions in `Decisions Required Before Execution` have explicit answers.

If a cut exposes a contradiction between docs, runtime, and Cloudflare config, stop and fix the contradiction before continuing.

Do not preserve dead public compatibility. If something survives, name the surviving owner and why it is real product truth.

Do not add a wrapper that keeps the old implicit behavior underneath.

---

## Execution Tenets And Proof Rules

This PRD is deletion-heavy. It must be executed with proof, not trust.

### Tenet 1 - Decisions Before Code

No runtime file may be edited until Cut 0 records final answers for:

- old-session invalidation
- password-login deletion
- whether `supabase_bridge` survives
- direct-provider email-change behavior
- Cloudflare must not use `CK_INTERNAL_SERVICE_JWT` as product auth glue
- no authz capsule cache
- delete-and-rebuild router strategy

If any answer is unknown, implementation stops.

### Tenet 2 - Delete First, Then Rebuild

For each cut, remove the old mechanism before shaping the replacement.

Examples:

- delete V1 refresh handling before polishing refresh code
- delete Michael service-role token brokering before reorganizing bridge helpers
- delete password route/UI/API before rebuilding route dispatch

No cut is green if it mainly adds a wrapper while the old behavior remains underneath.

### Tenet 3 - One Surviving Owner Per Concern

Each surviving concern must have one owner:

- session mode -> `SessionState.authMode`
- provider identity -> `login_identities`
- product session issuance -> Berlin direct-provider flow
- Roma account context -> Berlin bootstrap
- residual Michael reads -> named product API/private binding, or deletion

If two owners remain, the cut is not green.

### Tenet 4 - Negative Checks Are Required

Passing typecheck is not enough.

Every deletion cut must include `rg` checks proving old concepts are gone or only remain as documented intentional compatibility.

Required negative checks include:

```bash
rg "RefreshPayloadV1|payload.v === 1|supabaseRefreshToken.*payload" berlin/src
rg "auth/login/password|NEXT_PUBLIC_ROMA_PASSWORD_LOGIN|requestSupabasePasswordGrant" berlin roma documentation
rg "sec-fetch-site|sec-fetch-mode|sec-fetch-dest|internal_service_role|x-ck-internal-service" berlin roma documentation
rg "Boolean\\(.*supabaseRefreshToken|hasSupabaseSessionBridge" berlin/src
rg "function normalizeProfileLocation|type UserProfileRow" berlin/src
```

The expected result must be recorded for each cut:

- empty result, or
- only named compatibility references with a real owner and expiry/deletion path.

### Tenet 5 - LOC And Diff Proof

After every cut, implementation notes must report:

- files changed
- files deleted
- functions deleted
- old branches deleted
- net LOC change
- remaining references from required `rg` checks

If LOC is net-positive, the notes must explain why and identify which old code was actually removed.

### Tenet 6 - Stop On Hidden Dependency

If deletion is blocked by a live dependency, stop.

The implementation note must say:

- exact dependency found
- exact file/route/caller
- whether it is real product truth or residue
- recommended next action: delete dependency, replace dependency, or keep as named temporary compatibility

Do not silently keep the old mechanism.

### Tenet 7 - No Half-Green Cuts

A cut is green only when all of these are true:

- old mechanism deleted or explicitly named as temporary compatibility
- replacement behavior verified
- negative `rg` checks match expected results
- typecheck/build checks pass
- docs match runtime

If any one is false, do not start the next cut.

### Tenet 8 - Router Is Rebuilt From Survivors Only

Route cleanup must not preserve the old auth surface.

Required order:

1. delete dead auth/session routes
2. list surviving routes
3. rebuild route dispatch from that surviving list only
4. verify deleted routes are absent

The route table must be a map of the final product surface, not a nicer version of the old chain.

### Tenet 9 - No Permission Cache In This PRD

Do not cache authz capsules in this PRD.

Parallelizing reads is allowed.

Caching permission tickets is not allowed here because this PRD is about correctness and simplification. A future PRD may add caching only with a complete invalidation/version design.

### Tenet 10 - Final Proof Before Done

This PRD is not done until final proof shows:

- old implicit session mode gone
- marker-only Michael bridge gone
- V1 refresh gone
- public password login gone or strictly local-only with named owner
- direct-provider email-change is explicit, not a 503
- DB owns provider identity race
- duplicate normalization removed
- router rebuilt from surviving routes only
- docs and runtime agree

---

## Cut 0 - Deployment And Compatibility Inventory

### Why

Several required fixes affect live sessions, Cloudflare deployment behavior, and CI smoke. We need those facts before changing runtime behavior.

### Work

1. Confirm current Cloudflare deployment configuration for Berlin and Roma.
2. Confirm Berlin/Roma normal product paths do not need `CK_INTERNAL_SERVICE_JWT`.
3. Inventory every deployed path that still calls `/auth/michael/token`.
4. Confirm whether any cloud-dev smoke, CI, or manual workflow still calls:
   - `roma/app/api/session/login/route.ts`
   - `berlin POST /auth/login/password`
5. Confirm whether any V1 refresh tokens can still exist.
6. Decide whether this PRD will intentionally revoke old sessions by bumping session state compatibility.

### Files To Inspect

- `berlin/wrangler.toml`
- `roma/wrangler.toml`
- `.github/workflows/*`
- `scripts/*`
- `roma/app/login/page.tsx`
- `roma/app/api/session/login/route.ts`
- `berlin/src/route-dispatch.ts`
- `berlin/src/routes-login.ts`
- `berlin/src/types.ts`
- `berlin/src/routes-session.ts`

### Green Gate

- Cloudflare secret state is known.
- Password-login caller state is known.
- V1 refresh-token compatibility decision is recorded in the implementation notes.
- If old sessions will be invalidated, that is deliberate and documented.

### 2026-04-26 Execution Notes

Status: GREEN - RUNTIME CODE MAY START AT CUT 1

Final product decisions:

- Old sessions: invalidate sessions that do not carry explicit `authMode`; force re-login.
- Password login: delete customer/public password login.
- Supabase bridge sessions: delete unless Cut 1 exposes a non-password product dependency. No current product dependency is accepted.
- Direct-provider email change: hide/disable in Roma for now; Berlin returns explicit unsupported for direct-provider sessions.
- Michael bridge: do not keep service-role token brokering as Cloudflare product architecture; delete or replace remaining callers with named product APIs/private bindings.
- Authz capsule cache: no cache in this PRD; parallelize safe reads only.
- Router: delete dead auth/session paths first, then rebuild route dispatch from surviving routes only.

Inventory findings:

- `berlin/src/route-dispatch.ts` still exposes `POST /auth/login/password`.
- `roma/app/api/session/login/route.ts` still proxies to Berlin password login.
- `roma/app/login/page.tsx` still contains hidden password-login state/UI behind `NEXT_PUBLIC_ROMA_PASSWORD_LOGIN`.
- `.github/workflows/cloud-dev-runtime-verify.yml` still uses `CLOUD_DEV_SMOKE_EMAIL` + `CLOUD_DEV_SMOKE_PASSWORD` and calls `POST https://roma.dev.clickeen.com/api/session/login`.
- `berlin/src/routes-session.ts` still has marker-only Michael bridge fallback when `CK_INTERNAL_SERVICE_JWT` is missing.
- `berlin/src/routes-session.ts` still detects Supabase bridge mode via `Boolean(session.supabaseRefreshToken)`.
- `berlin/src/routes-session.ts` still reconstitutes KV session state from V1 refresh token payloads.
- `berlin/src/jwt-crypto.ts` still validates `RefreshPayloadV1`.

Cloudflare/deploy configuration:

- `berlin/wrangler.toml` binds `BERLIN_SESSION_KV` and does not define `CK_INTERNAL_SERVICE_JWT` in checked-in vars.
- `roma/wrangler.toml` uses `TOKYO_ASSET_CONTROL` and `TOKYO_PRODUCT_CONTROL` Cloudflare service bindings for product control and does not define `CK_INTERNAL_SERVICE_JWT` in checked-in vars.
- Local Wrangler cannot list remote secrets with the available local Cloudflare token, but this PRD no longer requires confirming or adding `CK_INTERNAL_SERVICE_JWT` for Berlin/Roma product runtime.
- Final verification must prove Berlin/Roma deployed product behavior does not depend on `CK_INTERNAL_SERVICE_JWT`.

Accepted password-smoke replacement:

- Current cloud-dev authenticated smoke depends on password login. That dependency must be replaced before password login can be deleted.
- The replacement must not be a new Cloudflare dependency on `CK_INTERNAL_SERVICE_JWT`.
- PRD 77 will remove the password-based authenticated smoke from `.github/workflows/cloud-dev-runtime-verify.yml`.
- CI keeps non-auth deploy/reachability checks.
- Final cloud-dev smoke becomes manual Google login, Roma bootstrap, Builder open/save, Widgets/Templates read, account locale read/write, assets path read/write, and logout.
- If automated authenticated CI smoke is required later, it needs a separate PRD for a real test-provider or Cloudflare-native private smoke path. Do not keep public password login and do not use `CK_INTERNAL_SERVICE_JWT` as Cloudflare product auth glue.

Roma Michael bridge caller inventory and replacement owner:

- `roma/lib/michael-catalog.ts`
  - `loadAccountWidgetCatalog`: reads `widget_instances`, account-owned `curated_widget_instances`, `widgets`, and `account_publish_containment`.
  - Surviving owner: Berlin product account catalog endpoint. Roma passes Berlin access token; Berlin reads Michael internally and returns registry/catalog data. Tokyo remains saved-document identity and serve-state owner.
  - `loadTemplateCatalog`: reads global curated templates and widget types.
  - Surviving owner: Berlin product template catalog endpoint. Roma passes Berlin access token; Berlin reads Michael internally and returns template registry data.
- `roma/lib/michael-instance-rows.ts`
  - `getAccountInstanceCoreRow`: reads account or curated registry row and widget type.
  - Surviving owner: Berlin product instance registry endpoint.
  - `createAccountInstanceRow`: creates account registry row after Tokyo saved document creation.
  - Surviving owner: Berlin product instance registry endpoint.
  - `deleteAccountInstanceRow`: deletes account registry row after/around Tokyo document cleanup.
  - Surviving owner: Berlin product instance registry endpoint.
  - `loadAccountPublishContainment`: reads account publish containment.
  - Surviving owner: Berlin product account catalog endpoint.
  - `listAccountInstancePublicIds`: reads account registry public ids for locale sync/publish counts.
  - Surviving owner: Berlin product account catalog endpoint.
- `roma/lib/account-base-locale-lock.ts`
  - `loadAccountBaseLocaleLockState`: reads account registry public ids, then confirms Tokyo saved documents.
  - Surviving owner: Berlin product account public-id endpoint for registry ids; Tokyo remains saved-document owner.
- `roma/lib/michael-shared.ts`
  - `resolveMichaelAccessToken`, `createMichaelHeaders`, and `fetchMichaelListRows` exist only to broker direct Roma -> Michael reads through Berlin.
  - Surviving owner: none. Delete once the callers above move to Berlin product endpoints.

V1 refresh/session compatibility decision:

- Old sessions without explicit `authMode` are deliberately invalid after this PRD.
- V1 refresh token compatibility is deleted in Cut 4; old refresh tokens force normal login.

Cut 0 verification:

- Password-login caller state is known: `.github/workflows/cloud-dev-runtime-verify.yml`, `roma/app/api/session/login/route.ts`, `roma/app/login/page.tsx`, and Berlin `/auth/login/password`.
- Michael bridge caller state is known and replacement owner is recorded above.
- Cloudflare runtime target is known: Berlin/Roma product paths must not require `CK_INTERNAL_SERVICE_JWT`.
- Cut 1 may start.

---

## Cut 1 - Remove The Michael Service-Role Token Bridge

### Why

This is the most sensitive surface. It can return the Supabase service-role key, and a shared Cloudflare secret would only preserve the wrong shape.

### Work

1. Inventory every Roma caller of `resolveMichaelAccessToken`, `createMichaelHeaders`, and `fetchMichaelListRows`.
2. For each caller, name the surviving owner:
   - Berlin product/account endpoint
   - Tokyo-owned API
   - Cloudflare-native private binding
   - deletion if the caller is dead/non-product
3. Move the caller off `/auth/michael/token`.
4. Delete the direct-provider branch that returns `internal_service_role`.
5. Delete marker-only trust and browser-header heuristic fallback.
6. Do not add a Cloudflare `CK_INTERNAL_SERVICE_JWT` requirement as the replacement.
7. Add focused tests or route-level assertions proving browser/server-shaped marker requests cannot receive service-role access.

### Delete

- Direct-provider service-role return from `/auth/michael/token`.
- Browser-header heuristic checks as an auth substitute.
- Any test fixture that expects marker-only access.
- Roma bridge helper paths that exist only to fetch a Michael token.

### Files

- `berlin/src/routes-session.ts`
- `roma/lib/michael-shared.ts`
- `roma/lib/michael-catalog.ts`
- `roma/lib/michael-instance-rows.ts`
- `roma/lib/account-base-locale-lock.ts`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/architecture/CloudflarePagesCloudDevChecklist.md`

### Green Gate

- `rg "internal_service_role|isTrustedRomaMichaelTokenRequest|sec-fetch-site|sec-fetch-mode|sec-fetch-dest" berlin/src roma` returns empty or only intentional tests proving rejection.
- `rg "resolveMichaelAccessToken|createMichaelHeaders|fetchMichaelListRows|/auth/michael/token" roma berlin/src` returns empty or only a named compatibility path with a deletion date.
- Direct-provider Berlin sessions cannot receive a Supabase service-role token through any HTTP route.
- Widgets/Templates/Builder/account-locale/assets paths that previously touched Michael still work through the named surviving owner.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`
- `pnpm exec tsc -p roma/tsconfig.json --noEmit`

### 2026-04-26 Cut 1 Execution Notes

Status: GREEN

What changed:

- Added Berlin-owned account registry endpoints for widget catalog, template catalog, instance registry get/create/delete, account public ids, and publish containment.
- Moved Roma off the Michael token broker; Roma now calls Berlin product endpoints with the current Berlin bearer.
- Deleted the direct-provider service-role return path, marker-only Roma trust, and browser-header heuristic from Berlin.
- Removed the `/auth/michael/token` dispatch route.
- Updated Berlin/Roma/Cloudflare docs so product runtime no longer requires `CK_INTERNAL_SERVICE_JWT` for this path.

Files changed:

- `berlin/src/account-instance-registry.ts` added.
- `berlin/src/routes-account.ts`
- `berlin/src/route-dispatch.ts`
- `berlin/src/routes-session.ts`
- `roma/lib/michael-shared.ts`
- `roma/lib/michael-catalog.ts`
- `roma/lib/michael-instance-rows.ts`
- `roma/lib/account-base-locale-lock.ts`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/architecture/CloudflarePagesCloudDevChecklist.md`

Deletion proof:

- Deleted `handleMichaelToken`.
- Deleted `isTrustedRomaMichaelTokenRequest`.
- Deleted `resolveInternalServiceHeaderToken`.
- Deleted `resolveSupabaseServiceRoleKey`.
- Deleted Roma `resolveMichaelAccessToken`.
- Deleted Roma `createMichaelHeaders`.
- Deleted Roma `fetchMichaelListRows`.
- Deleted direct Roma -> Michael/PostgREST reads from the affected product paths.

LOC proof:

- Tracked diff for Cut 1 runtime/docs: 437 insertions, 729 deletions.
- New Berlin owner file: 559 LOC.
- Effective Cut 1 code/doc total: 996 insertions, 729 deletions, net +267.
- Net positive is expected in this cut because the service-role broker was replaced by explicit Berlin product endpoints. The toxic token-broker path and direct Roma Michael helpers were deleted.

Verification:

```bash
rg "internal_service_role|isTrustedRomaMichaelTokenRequest|sec-fetch-site|sec-fetch-mode|sec-fetch-dest" berlin/src roma -g '!node_modules'
rg "resolveMichaelAccessToken|createMichaelHeaders|fetchMichaelListRows|/auth/michael/token" roma berlin/src documentation/services documentation/architecture -g '!node_modules'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
corepack pnpm exec tsc -p roma/tsconfig.json --noEmit
git diff --check
```

All returned green. The only remaining `CK_INTERNAL_SERVICE_JWT` reference in the touched Berlin/Roma docs states it is local/internal tooling only, not Berlin/Roma product runtime.

---

## Cut 2 - Add Explicit Session Auth Mode

### Why

The current model makes runtime behavior depend on whether optional Supabase fields happen to be present. That is the root seam.

### Work

1. Add an `AuthMode` type.
2. Make `SessionIssueArgs.authMode` explicit.
3. Make Google/direct-provider issuance set `authMode: 'direct_provider'`.
4. If password/smoke bridge survives, make it set `authMode: 'supabase_bridge'`.
5. Update `SessionState` parsing in `session-kv.ts` to validate `authMode`.
6. Update `handleMichaelToken` to branch on `authMode`.
7. Update `ensureSupabaseAccessToken` to accept only validated Supabase-bridge session state.
8. Bump session-state compatibility if needed so old state without `authMode` does not stay silently valid.

### Delete

- `hasSupabaseSessionBridge = Boolean(session.supabaseRefreshToken)` as the session-mode detector.
- Any code path that treats token presence as product truth.
- Any silent healing of missing `authMode`.

### Files

- `berlin/src/types.ts`
- `berlin/src/auth-session.ts`
- `berlin/src/session-kv.ts`
- `berlin/src/routes-login.ts`
- `berlin/src/routes-session.ts`
- `berlin/src/routes-account.ts`

### Green Gate

- Direct-provider login creates a session with `authMode: 'direct_provider'`.
- Supabase-bridge smoke path, if retained, creates `authMode: 'supabase_bridge'`.
- A session with missing/invalid `authMode` is rejected.
- Direct-provider sessions never call Supabase refresh.
- Supabase-bridge code cannot compile unless it handles the typed bridge state.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`

### 2026-04-26 Cut 2 Execution Notes

Status: GREEN

What changed:

- Added explicit `AuthMode = 'direct_provider' | 'supabase_bridge'`.
- Made `SessionState` discriminated by `authMode`.
- Made session issuance require `authMode`.
- Google/provider sessions now issue `authMode: 'direct_provider'`.
- The temporary password/Supabase bridge path now issues `authMode: 'supabase_bridge'`.
- Session KV parsing now rejects missing/invalid `authMode`, intentionally forcing old sessions to log in again.
- Removed refresh-time KV reconstitution from old V1 payloads so old token payloads cannot silently recreate session state.
- Direct-provider email-change now returns explicit unsupported instead of entering Supabase refresh.

Deletion proof:

- Removed the `payload.v === 1` session-state recreation branch from `handleRefresh`.
- Removed implicit session-mode detection by optional Supabase token presence.
- `ensureSupabaseAccessToken` now accepts only typed `SupabaseBridgeSessionState`.

LOC proof:

- Cut 2 estimate from changed Berlin session files: about 99 insertions, 43 deletions.
- Net positive is from the explicit session union and validation; the old implicit branch and V1 session recreation code were deleted.

Verification:

```bash
rg "Boolean\\(.*supabaseRefreshToken|hasSupabaseSessionBridge" berlin/src -g '!node_modules'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --check
```

All returned green. Remaining `supabaseRefreshToken` references are the explicitly typed temporary `supabase_bridge` path and V1 payload type slated for Cut 4 deletion.

---

## Cut 3 - Clean Email Change And Password Compatibility

### Why

Email change currently assumes Supabase Auth is the product identity manager. That is false for direct-provider Clickeen sessions.

Password login currently keeps the old session model live and public.

### Work

1. Redefine `/v1/me/email-change` behavior for direct-provider sessions.
2. Return an explicit unsupported/currently-unavailable response until a verified Clickeen contact-email flow exists.
3. Update Roma profile/settings UI so it does not present email change as working for direct-provider sessions.
4. Decide from Cut 0 whether password login is deleted or local-only gated.
5. Preferred: delete public password login from Berlin dispatch and delete Roma password login route/UI.
6. If retained for local smoke, require explicit local env and document it as non-product.

### Delete

Preferred deletion set:

- `roma/app/api/session/login/route.ts`
- password form state and submit path in `roma/app/login/page.tsx`
- `POST /auth/login/password` dispatch in Berlin
- `handlePasswordLogin` if no local smoke path remains
- Supabase password grant helpers if no longer used

If local smoke path survives:

- Delete customer/cloud reachability.
- Delete hidden product UI.
- Delete any docs that imply password login is a customer path.

### Files

- `berlin/src/routes-account.ts`
- `berlin/src/routes-login.ts`
- `berlin/src/route-dispatch.ts`
- `berlin/src/supabase-client.ts`
- `roma/app/login/page.tsx`
- `roma/app/api/session/login/route.ts`
- `roma/app/api/me/email-change/route.ts`
- Profile/settings UI that calls `/api/me/email-change`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`

### Green Gate

- Google/direct-provider user does not get a 503 from email change.
- Roma no longer shows a broken email-change control.
- Password login is either deleted or impossible to use from cloud customer routes.
- Documentation matches the actual runtime surface.
- `rg "auth/login/password|NEXT_PUBLIC_ROMA_PASSWORD_LOGIN|requestSupabasePasswordGrant" berlin roma documentation` returns only intentional local-smoke references or nothing.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`
- `pnpm exec tsc -p roma/tsconfig.json --noEmit`

### 2026-04-26 Cut 3 Execution Notes

Status: GREEN

What changed:

- Deleted Roma's same-origin password login route.
- Deleted Roma's hidden password form state, submit path, env flag, and invalid-password copy.
- Deleted Berlin public `POST /auth/login/password` dispatch.
- Deleted `handlePasswordLogin`.
- Deleted `issueProductSessionFromGrant`.
- Deleted the Supabase password grant helper by deleting the unused Berlin Supabase auth client.
- Removed password-based authenticated smoke from GitHub cloud-dev runtime verification.
- Removed `supabase_bridge` session mode after password login deletion proved it had no surviving product owner.
- Simplified Berlin email-change to one explicit unsupported response for provider-managed email.
- Deleted Roma's email-change proxy route and removed the broken email-change controls from User Settings.
- Updated Berlin/Roma/cloud-dev docs to match provider-only login and manual authenticated smoke.

Files deleted:

- `roma/app/api/session/login/route.ts`
- `roma/app/api/me/email-change/route.ts`
- `berlin/src/supabase-client.ts`

Functions/branches deleted:

- `handlePasswordLogin`
- `issueProductSessionFromGrant`
- `requestSupabasePasswordGrant`
- `requestSupabaseRefreshGrant`
- `requestSupabasePkceGrant`
- `requestSupabaseOAuthUrl`
- `requestSupabaseUser`
- `requestSupabaseUpdateUserEmail`
- `requestSupabaseUnlinkIdentity`
- `ensureSupabaseAccessToken`
- `ensureProductAccountState`
- Supabase-user-to-provider adapter functions in `account-reconcile.ts`
- `supabase_bridge` session parsing and issuance branches
- Password-login rate limit policy
- Password-login CI smoke branch

LOC proof:

- Current tracked runtime/docs diff after Cut 3: 487 insertions, 1840 deletions.
- Cut 3 deleted three files totaling 441 LOC from the tracked tree.
- The remaining new Berlin registry file from Cut 1 is intentional replacement code for the deleted Michael token broker and is recorded in Cut 1.

Remaining references:

- `rg "auth/login/password|NEXT_PUBLIC_ROMA_PASSWORD_LOGIN|requestSupabasePasswordGrant|CLOUD_DEV_SMOKE_EMAIL|CLOUD_DEV_SMOKE_PASSWORD" berlin roma documentation/services documentation/architecture .github/workflows -g '!node_modules'` returned empty.
- `rg "supabase_bridge|SupabaseBridge|ensureSupabaseAccessToken|requestSupabase|supabase-client|SupabaseTokenResponse|SupabaseUserResponse|SupabaseIdentity" berlin/src documentation/services/berlin.md -g '!node_modules'` returned empty.
- `email-change` remains only as Berlin's explicit unsupported API boundary and route dispatch entry. Roma no longer exposes the proxy or UI control.

Verification:

```bash
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
corepack pnpm exec tsc -p roma/tsconfig.json --noEmit
git diff --check
```

All returned green. Roma `.next` was removed before the second Roma typecheck because stale generated route types still referenced the deleted routes.

---

## Cut 4 - Delete V1 Refresh Compatibility

### Why

V1 refresh tokens carried a client-visible Supabase refresh token in the signed body and can recreate KV session state. That is old-session compatibility, not current product truth.

### Work

1. Remove `RefreshPayloadV1`.
2. Remove V1 validation from `verifyRefreshToken`.
3. Remove V1 KV session reconstitution from `handleRefresh`.
4. Reject unknown refresh payload versions.
5. If old sessions are intentionally invalidated, bump session key/prefix/version and document the forced re-login.

### Delete

- `RefreshPayloadV1`
- V1 branch in `verifyRefreshToken`
- `if (!state && payload.v === 1)` branch in `handleRefresh`
- tests that assert V1 refresh success

### Files

- `berlin/src/types.ts`
- `berlin/src/jwt-crypto.ts`
- `berlin/src/routes-session.ts`
- `berlin/src/session-kv.ts` if prefix/version is bumped
- Berlin tests/fixtures
- `documentation/services/berlin.md`

### Green Gate

- V1 refresh token fails with auth-required.
- Current refresh token succeeds.
- Missing KV state does not get recreated from token payload.
- User-session revocation logic still works for current sessions.
- `rg "RefreshPayloadV1|payload.v === 1|supabaseRefreshToken.*payload" berlin/src` returns no live compatibility path.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`

### 2026-04-26 Cut 4 Execution Notes

Status: GREEN

What changed:

- Deleted `RefreshPayloadV1`.
- Made `RefreshPayload` equal the current V2 shape only.
- Deleted V1 validation from `verifyRefreshToken`.
- Left `handleRefresh` on the current KV-backed V2 path only.
- Documented that old V1 refresh tokens force normal login.

Files changed:

- `berlin/src/types.ts`
- `berlin/src/jwt-crypto.ts`
- `documentation/services/berlin.md`

Deletion proof:

- Deleted the V1 branch in `verifyRefreshToken`.
- Deleted the V1 payload type.
- Deleted the last Berlin source reference to `supabaseRefreshToken`.

LOC proof:

- Current tracked runtime/docs diff after Cut 4: 489 insertions, 1864 deletions.
- Cut 4 touched files show 29 insertions and 70 deletions in the current diff against `HEAD`.

Remaining references:

- `rg "RefreshPayloadV1|payload.v === 1|version === 1|supabaseRefreshToken.*payload|supabaseRefreshToken" berlin/src -g '!node_modules'` returned empty.

Verification:

```bash
rg "RefreshPayloadV1|payload.v === 1|version === 1|supabaseRefreshToken.*payload|supabaseRefreshToken" berlin/src -g '!node_modules'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --check
```

All returned green. Runtime behavior now rejects any non-V2 refresh payload via the existing `version !== 2` branch, which maps to `coreui.errors.auth.required` at `/auth/refresh`.

---

## Cut 5 - Move Provider Identity Race Resolution To The Database

### Why

`resolveProductUserForIdentity` currently implements a distributed transaction in application code. The database already owns the unique provider identity constraint and should return the winning user id.

### Work

1. Add a Supabase migration/RPC for Berlin-owned identity resolution.
2. The RPC must accept normalized provider identity/profile seed fields.
3. The RPC must:
   - find existing `login_identities(provider, provider_subject)`
   - update last-used/provider metadata when found
   - create or merge the user profile when new
   - insert `login_identities`
   - return the authoritative `user_id`, login identity id, and whether the user/identity was created
4. Update `account-reconcile.ts` to call the RPC.
5. Keep account membership/provisioning logic in Berlin after identity resolution.
6. Delete app-level conflict retry/reread code.

### Required Database Shape

The RPC must rely on:

- `login_identities_provider_subject_unique`
- `login_identities.user_id -> user_profiles(user_id)`
- service-role-only execution

### Delete

- `loadLoginIdentity` if used only by the old race handler.
- `writeLoginIdentity` if replaced by the RPC.
- manual conflict reread/retry branch in `resolveProductUserForIdentity`.
- second profile write for the raced winner.

### Files

- `supabase/migrations/*`
- `berlin/src/account-reconcile.ts`
- `berlin/src/supabase-admin.ts` only if RPC helper ergonomics are needed
- tests/fixtures around first login

### Green Gate

- Two concurrent first-logins for the same provider identity produce one user profile and one login identity.
- Existing login updates provider metadata and returns the same `user_id`.
- New login creates profile + login identity exactly once.
- Invitation signup still accepts the invitation before personal-account provisioning.
- Normal first signup still creates one free account and one owner membership.
- No app-level provider identity conflict retry remains.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`
- Supabase migration applies cleanly to local/cloud-dev target.

### 2026-04-26 Cut 5 Execution Notes

Status: GREEN

What changed:

- Added `public.resolve_login_identity(...)`, a service-role-only RPC that owns provider identity resolution.
- The RPC serializes by provider + provider subject with `pg_advisory_xact_lock`.
- The RPC returns the winning `user_id`, login identity id, whether user/profile was created, whether identity was created, and active account preference.
- Berlin now calls `/rest/v1/rpc/resolve_login_identity` instead of implementing the identity race in application code.
- Updated Berlin docs to name `resolve_login_identity` as the surviving identity-resolution owner.

Files changed:

- `supabase/migrations/20260426120000__prd77_resolve_login_identity_rpc.sql` added.
- `berlin/src/account-reconcile.ts`
- `documentation/services/berlin.md`

Functions/branches deleted:

- `loadLoginIdentity`
- `writeLoginIdentity`
- `loadExistingUserProfile`
- `upsertUserProfile`
- `resolveNewProductUserId`
- app-level conflict reread/retry around `login_identities`
- second profile write for the raced winner path

LOC proof:

- Current tracked runtime/docs diff after Cut 5: 547 insertions, 2069 deletions.
- Cut 5 tracked touched files show 76 insertions and 306 deletions against `HEAD`.
- New migration file is 198 LOC.
- Net Cut 5 effect on the touched source/docs/migration set is approximately 274 insertions and 306 deletions, net -32 LOC.

Remaining references:

- `rg "loadLoginIdentity|writeLoginIdentity|loadExistingUserProfile|upsertUserProfile|resolveNewProductUserId|racedIdentity|racedProfile|on_conflict.*login_identities|/rest/v1/login_identities\\?" berlin/src/account-reconcile.ts -g '!node_modules'` returned empty.
- `resolve_login_identity` remains in the migration, Berlin RPC caller, and Berlin docs.

Verification completed:

```bash
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --check
```

Both returned green.

CI verification:

- The full Cut 5 gate requires applying the Supabase migration.
- This workspace does not have the Supabase CLI, `psql`, Docker, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_CLOUD_DEV`, or `SUPABASE_PROJECT_REF_CLOUD_DEV` available to apply or verify the migration locally or against cloud-dev.
- The accepted verification path was GitHub CI on `main`: `.github/workflows/cloud-dev-workers.yml` applies `supabase/migrations/**` through `supabase db push --linked --include-all --yes` before deploying Berlin.
- Commit `6d90405695171089b36a6176722bb0b9a09b29aa` pushed to `github/main`.
- `cloud-dev workers deploy` completed successfully for that commit, proving migration apply and Berlin deploy passed.
- `cloud-dev roma app verify` completed successfully for that commit.
- Cut 6 may start.

### 2026-04-27 Cut 5 Correction And Login Repair

Status: HOTFIX APPLIED

The previous CI note was wrong. GitHub checked out a shallow history, so the migration-detection step could not inspect the previous SHA and skipped Supabase migration apply while still deploying Berlin. The live PostgREST schema therefore did not expose `public.resolve_login_identity(...)`, and login failed with `PGRST202`.

Repair:

- Berlin login no longer calls `/rest/v1/rpc/resolve_login_identity`.
- Berlin resolves login identity through the already-live `login_identities` and `user_profiles` tables using its existing service-role boundary.
- The workflow checkout now uses full history and refuses to guess migration state if the previous SHA is unavailable.
- Berlin docs were updated so runtime and documentation match.

Verification:

- Live Supabase `login_identities` table read returned `200`.
- Live Supabase `user_profiles` table read returned `200`.
- `corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit` returned green.

---

## Cut 6 - Make Bootstrap Faster Without Weakening Authz

### Why

Bootstrap is canonical account truth for Roma. It must be correct first, then fast.

### Work

1. Parallelize independent reads in principal/bootstrap loading where safe.
2. Start identity loading as soon as the principal session is known, not after all account state work, if that simplifies the flow.
3. Keep bootstrap read-only; do not repair missing profile/account state on the hot path.
4. Redesign `authzVersion` before caching.
5. `authzVersion` or cache key must include every signed capsule input that affects:
   - user id
   - account id
   - account status
   - platform flag
   - account name
   - account slug
   - website URL
   - role
   - tier/profile
   - entitlement snapshot
   - signing key id
6. Cache signed authz capsule only after the version/key is strong enough.
7. Use a TTL shorter than `ROMA_AUTHZ_CAPSULE_TTL_SEC`.

### Must Not Do

- Do not cache on `account_members.created_at` alone.
- Do not cache a capsule when the key omits role/tier/status.
- Do not make bootstrap silently return stale entitlements after account/member changes.
- Do not add a second bootstrap authority in Roma.

### Files

- `berlin/src/account-state.ts`
- `berlin/src/account-state.types.ts`
- `berlin/src/routes-account.ts`
- `berlin/src/types.ts` if a cache key prefix is added
- tests around bootstrap/authz capsule

### Green Gate

- Bootstrap still fails on missing profile/account state.
- Bootstrap returns identical payload semantics before/after refactor.
- Direct-provider login -> Roma bootstrap succeeds.
- Authz capsule changes when role/tier/account signed inputs change.
- If caching is implemented, stale capsule cannot survive a role/tier/status/name/slug change.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`

### 2026-04-27 Cut 6 Execution Notes

Status: GREEN

What changed:

- Parallelized bootstrap principal state reads: profile, account memberships, and contact methods now start together.
- Parallelized bootstrap identity loading and signing-key resolution.
- Replaced membership-created-at `authzVersion` with a deterministic `authz:v2` hash over every signed authz input plus signing key id.
- Did not add authz capsule caching, following PRD Tenet 9.

Files changed:

- `berlin/src/account-state.ts`

Deletion/simplification proof:

- Removed the sequential profile -> memberships -> contact-method waterfall in `loadPrincipalAccountState`.
- Removed `activeAccount.membershipVersion || fallback` as the authz version source.
- Kept bootstrap read-only and fail-fast.

LOC proof:

- Cut 6 touched files against `HEAD`: 86 insertions, 37 deletions.
- Net positive is from the explicit stable authz hash helper; no cache or second bootstrap owner was added.

Verification:

```bash
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --check
```

Both returned green.

---

## Cut 7 - Consolidate Profile Normalization And Remove Wasteful Re-Reads

### Why

There are duplicate profile row types and duplicate profile-location normalization implementations. Write handlers also rerun full account-state loads in places where narrower results are enough.

### Work

1. Create one shared profile row/normalization module inside Berlin.
2. Move `normalizeProfileLocation` to one owner.
3. Make both account reconciliation and account state use that owner.
4. Replace full post-write account-state reloads with narrower reads or returned write results where safe.
5. Keep full reloads only where the write changes principal authorization and a fresh principal view is actually needed.

### Delete

- Duplicate `UserProfileRow` definitions where possible.
- Duplicate `normalizeProfileLocation` implementation.
- Full `loadPrincipalAccountState` after profile update if a narrower profile response is enough.
- Full `loadPrincipalAccountState` after account create if the created account can be returned from a narrower authoritative read.

### Files

- `berlin/src/account-reconcile.ts`
- `berlin/src/account-state.ts`
- `berlin/src/user-profiles.ts`
- `berlin/src/routes-account.ts`
- `berlin/src/account-governance.ts`
- `berlin/src/account-invitations.ts`
- new shared Berlin profile helper only if it replaces duplication rather than adding a second layer

### Green Gate

- One profile-location normalizer remains.
- Profile row shape changes have one primary owner.
- Profile update still returns current user/profile.
- Account create still returns the created active account.
- Owner transfer and invitation accept still return correct account context.
- `rg "function normalizeProfileLocation|type UserProfileRow" berlin/src` shows only intentional owners.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`

### 2026-04-27 Cut 7 Execution Notes

Status: GREEN

What changed:

- Added `berlin/src/profile-normalization.ts` as the single Berlin owner for profile row shape, boolean normalization, profile payload mapping, and profile country/timezone normalization.
- Rewired account bootstrap state, account-member profile reads, and first-login account reconciliation to use that owner.
- Changed profile update to return the patched profile from the authoritative `PATCH ... return=representation` result.
- Removed the full `loadPrincipalAccountState` re-read after `/me` profile update; the route now returns the resolved current user plus the patched profile and unchanged contact methods.
- Kept full account-state reloads for account create, owner transfer, and invitation accept because those writes change account context/authorization truth.

Deletion/simplification proof:

- Removed duplicate `UserProfileRow` and `UserProfileSummaryRow` shapes from `account-state`.
- Removed duplicate `normalizeBoolean` and `normalizeProfileLocation` from `account-state`.
- Removed duplicate profile-location normalization plus country/timezone helpers from `account-reconcile`.
- Removed one wasteful post-profile-update principal-state reload from `routes-account`.

LOC proof:

- Tracked Cut 6+7 working diff at this checkpoint: 180 insertions, 170 deletions across tracked files.
- New shared profile owner: 64 LOC, replacing duplicate row/normalization code in existing modules.

Verification:

```bash
rg -n "function normalizeProfileLocation|type UserProfileRow" berlin/src
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --check
```

All returned green. The `rg` ownership check now returns only:

```text
berlin/src/profile-normalization.ts:4:export type UserProfileRow = {
berlin/src/profile-normalization.ts:33:export function normalizeProfileLocation(rawCountry: unknown, rawTimezone: unknown): {
```

---

## Cut 8 - Replace Linear Route Dispatch With A Route Table

### Why

This is lower risk than the auth fixes, but it closes the maintainability issue from the analysis. The route list should be visible as data, with method and parameter extraction explicit.

### Work

1. Introduce a small Berlin route table.
2. Keep the implementation local to Berlin; do not introduce a framework.
3. Preserve all surviving route behavior exactly.
4. Put internal, auth, session, bootstrap, and residual account routes in deliberate order.
5. Delete route code for any password/V1/dead surface removed in earlier cuts.

### Must Preserve

- Exact method handling and `methodNotAllowed` responses.
- Existing URL parameter decoding.
- Existing not-found shape unless deliberately changed.

### Files

- `berlin/src/route-dispatch.ts`
- route handler imports as needed
- Berlin route tests if present or added

### Green Gate

- Surviving Berlin runtime surface is visible in one route table.
- Removed routes are absent.
- No route is shadowed by a broader regex.
- Health, JWKS, provider start/callback, finish, session, refresh, logout, bootstrap, and residual account routes still dispatch correctly.
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit`

### 2026-04-27 Cut 8 Execution Notes

Status: GREEN

What changed:

- Replaced the linear `if (pathname...)` dispatcher with one ordered `BERLIN_ROUTES` table in `berlin/src/route-dispatch.ts`.
- Kept routing local to Berlin: no framework, no new package, no new abstraction outside this file.
- Preserved the existing trailing-slash normalization, `methodNotAllowed()` behavior, URL parameter decoding, and `{ error: 'NOT_FOUND' }` fallback.
- Kept the exact route order where shadowing matters, especially `/auth/login/provider/start` before `/auth/login/:provider/start` and account-member detail before account-member list.

Deletion/simplification proof:

- Deleted the old route-by-route conditional chain from `dispatchBerlinRequest`.
- The surviving runtime surface is now visible as route data.
- Removed password, Michael-token, Supabase-bridge, and V1 refresh surfaces were not reintroduced.

LOC proof:

- `berlin/src/route-dispatch.ts`: 207 insertions, 250 deletions.

Verification:

```bash
rg -n "pathname ===|pathname\\.match|if \\(pathname|methodNotAllowed\\(" berlin/src/route-dispatch.ts
rg -n "/auth/login/password|NEXT_PUBLIC_ROMA_PASSWORD_LOGIN|requestSupabasePasswordGrant|CLOUD_DEV_SMOKE_EMAIL|CLOUD_DEV_SMOKE_PASSWORD|/auth/michael/token|RefreshPayloadV1|payload\\.v === 1|version === 1|supabaseRefreshToken|supabase_bridge" berlin/src roma/app documentation/services documentation/architecture .github/workflows -g '!node_modules'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --check
```

All returned green. The structural route-dispatch check now returns only the table loop and the single generic method gate.

---

## Cut 9 - Documentation, Cloud Verification, And Final Cleanup

### Work

1. Update `documentation/services/berlin.md` to match final runtime.
2. Update `documentation/services/roma.md` for auth/session login surface.
3. Update Cloudflare cloud-dev checklist to state that Berlin/Roma product runtime must not require `CK_INTERNAL_SERVICE_JWT`.
4. Update any architecture docs that still imply password login or marker-only bridge authority.
5. Remove stale comments that describe the old cloud-dev missing-JWT state as acceptable.
6. Run repo-level verification.
7. Deploy Berlin and Roma using the existing Clickeen deployment flow.
8. Smoke cloud-dev.

### Required Verification Commands

Run at minimum:

```bash
pnpm exec tsc -p berlin/tsconfig.json --noEmit
pnpm exec tsc -p roma/tsconfig.json --noEmit
pnpm lint
pnpm typecheck
```

Run app/build commands required by touched areas. If route behavior or migration changes are large, run broader `pnpm test`.

### Required Cloud Smoke

1. Google login starts and finishes through Roma.
2. Roma `/api/bootstrap` succeeds after login.
3. Roma account shell loads without auth bootstrap loops.
4. Builder open succeeds for an account widget.
5. Widgets/templates/Builder/account-locale/assets paths that previously needed Michael bridge still work through the surviving owner.
6. Browser/client cannot call `/auth/michael/token` successfully.
7. Direct-provider email change does not 503; it returns the explicit product response or is hidden in Roma.
8. Refresh succeeds for a current session.
9. Old refresh/session state either fails cleanly or is intentionally revoked.
10. Logout revokes/clears the current session.

### Green Gate

- Runtime, docs, and Cloudflare config agree.
- No stale compatibility route remains undocumented.
- No marker-only internal bridge remains.
- No V1 refresh compatibility remains.
- No implicit token-presence session-mode branch remains.
- Final `git diff` shows deletions of the old mechanisms, not only additive wrappers.

### 2026-04-27 Cut 9 Local Execution Notes

Status: LOCAL GREEN - CLOUD VERIFICATION RUNS FROM THE PUSHED `main` COMMIT

What changed:

- Updated Berlin service docs to state that `CK_INTERNAL_SERVICE_JWT` is only for the explicit internal-control route, not product auth/bootstrap/Builder/account registry paths.
- Updated the Cloudflare cloud-dev checklist to make the same product-runtime rule explicit while preserving San Francisco/internal-tooling secret ownership.
- Confirmed Berlin and Roma service docs already describe the surviving provider-auth, bootstrap, registry, and no-password-login surfaces.

Verification:

```bash
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
corepack pnpm exec tsc -p roma/tsconfig.json --noEmit
PATH="/tmp/clickeen-pnpm-shim:$PATH" corepack pnpm lint
PATH="/tmp/clickeen-pnpm-shim:$PATH" corepack pnpm typecheck
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --filter @clickeen/roma lint
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/roma build
git diff --check
```

All returned green locally. The `/tmp/clickeen-pnpm-shim` entry is a temporary local PATH shim because this machine has `corepack pnpm` but no standalone `pnpm` binary for Turbo to spawn.

---

## Deletion Ledger

These are deletion candidates. Implementation must either delete them or leave a short implementation note explaining the real surviving owner.

### Must Delete

- Browser-header heuristic fallback in `isTrustedRomaMichaelTokenRequest`.
- V1 refresh-token compatibility branch.
- V1 refresh payload type.
- Refresh-session reconstitution from client-visible token payload.
- Session-mode detection by optional `supabaseRefreshToken` presence.
- Duplicate profile-location normalization.
- App-level first-login identity conflict retry once DB RPC exists.

### Preferred Delete

- Public Berlin password login dispatch.
- Roma password login API route.
- Hidden Roma password form and `NEXT_PUBLIC_ROMA_PASSWORD_LOGIN`.
- Supabase password grant helpers if no local-smoke route survives.

### Conditional Delete

- Supabase-bridge session mode entirely, if password/smoke compatibility is removed and no other real caller needs it.
- `ensureSupabaseAccessToken`, if no Supabase-bridge session mode survives.
- Supabase user-email update helper, unless retained for a named non-product compatibility path.

---

## Risk Register

### Risk: Breaking Existing Sessions

Acceptable if deliberate. Clickeen is pre-GA and long-lived auth compatibility is not a product requirement.

Mitigation:

- Bump session state compatibility intentionally.
- Force normal login.
- Document it in deploy notes.

### Risk: Breaking Roma Routes That Still Read Michael

The residual Michael bridge is still used by Roma server routes.

Mitigation:

- Do not deploy the deletion until each caller has a named replacement owner.
- Smoke Widgets, Templates, Builder open/save, account locales, and assets paths that used to touch Michael.

### Risk: Caching Stale Authz

Authz capsule caching is dangerous if keyed poorly.

Mitigation:

- Do not cache until `authzVersion` or cache key includes every signed input.
- Prefer no cache over unsafe cache.
- Include signing key id in cache key.

### Risk: DB RPC Partial State

Identity resolution must not create a profile without a usable identity or vice versa.

Mitigation:

- Implement as a single database transaction/RPC.
- Return explicit errors on malformed provider/profile seed data.
- Test concurrent first-login.

### Risk: Product UI Shows Unsupported Email Change

Direct-provider sessions cannot mutate provider email through Supabase Auth.

Mitigation:

- Hide or clearly disable the email-change action until a product contact-email verification flow exists.
- API returns explicit unsupported, not 503.

---

## Success Criteria

This PRD is done when:

1. Berlin sessions have explicit auth mode.
2. Direct-provider sessions and Supabase-bridge sessions cannot be confused.
3. `/auth/michael/token` cannot return service-role access for direct-provider sessions, and normal Cloudflare product paths do not depend on `CK_INTERNAL_SERVICE_JWT`.
4. V1 refresh compatibility is gone.
5. Public password login is gone or explicitly local-only/non-product.
6. Direct-provider email-change behavior is clean and explicit.
7. First-login provider identity race is resolved by the database, not application retry logic.
8. Bootstrap is parallelized where safe and any capsule caching is keyed by stable authz truth.
9. Duplicate profile normalization is consolidated.
10. Wasteful post-write account-state reloads are removed where safe.
11. Berlin route dispatch is easier to audit.
12. Documentation, runtime, and Cloudflare config match.
