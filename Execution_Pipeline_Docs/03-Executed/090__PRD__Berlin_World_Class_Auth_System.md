# PRD 090 - Berlin Simplifying Architecture And Codebase

Status: Executed
Owner: Codex
Date: 2026-05-11
Architecture source: `documentation/architecture/CONTEXT.md`
Canonical account model: `documentation/architecture/AccountManagement.md`
Service source: `documentation/services/berlin.md`
Primary code surface: `berlin/src`

## 1. Purpose

This PRD is not a folder-renaming exercise.

Berlin must become simpler by having fewer surviving concepts, fewer product surfaces, fewer duplicate implementations, fewer self-checking flows, and fewer places where pre-GA legacy behavior can hide.

The corrected Berlin mandate is:

```text
Provider identity -> Clickeen user/account landing -> session -> bootstrap/authz capsule
```

Everything outside that line must be one of:

- deleted now;
- residual only because there is an active product caller;
- blocked by a named external contract, with no new abstraction added around it.

Success is measured by reduced behavioral surface and clearer surviving authority, not by moving files into prettier folders.

## 2. Non-Negotiable Simplification Rules

1. Delete before renaming.
2. Shrink behavior before reorganizing files.
3. No new framework, router platform, repository layer, provider platform, or generic utility system.
4. A route having callers is not proof it belongs in Berlin.
5. Residual routes may remain operational only when current Roma/Bob product paths still need them.
6. Do not make residual code look permanent through nicer naming.
7. Every added LOC must either remove more LOC, remove a behavior branch, or add a verification gate that prevents toxic behavior returning.
8. A slice that increases complexity without reducing behavior is red.
9. No slice may use a later cleanup pass to excuse preserving toxic flow now.

## 3. Product Truth

Berlin permanently owns:

- provider OAuth start/callback for supported login providers;
- provider identity to Clickeen user mapping;
- first-login account provisioning when no real membership exists;
- invitation acceptance during login;
- active account landing for the session;
- Berlin access/refresh token issuance;
- refresh rotation and session revocation;
- JWKS;
- `GET /auth/session`;
- read-only `GET /v1/session/bootstrap`;
- the stable account authz capsule consumed by Roma/Bob;
- auth/session request IDs, completion logs, and mutation rate-limit floor.

Berlin does not permanently own:

- team management;
- account settings;
- account locale settings;
- general profile mutation UX;
- contact-method product settings;
- post-login invitation issuing/revocation workflows;
- widget instance truth;
- saved config truth;
- publish/live state;
- l10n overlay state;
- Michael/PostgREST token vending;
- Supabase Auth/password compatibility.

## 4. Current Audit Findings To Close

### 4.1 File Size

No Berlin file is over 900 LOC.

The issue is not file size. The issue is product-surface concentration:

| File | LOC | Actual problem |
|---|---:|---|
| `berlin/src/account-management/routes.ts` | 682 | Broad residual product/account API inside auth service. |
| `berlin/src/account-management/invitations.ts` | 595 | Team invitation product workflow mixed with login-time invitation truth. |
| `berlin/src/bootstrap/state.ts` | 545 | Account landing, profile normalization, member listing, and bootstrap state mixed behind generic naming. |
| `berlin/src/auth/routes.ts` | 531 | Acceptable size for now; do not split unless behavior gets simpler. |
| `berlin/src/identity/reconcile.ts` | 435 | Provider identity mapping plus account provisioning plus compatibility residue. |

Required correction:

- Do not chase arbitrary LOC limits.
- Reduce broad residual product behavior.
- Split only when a surviving authority becomes smaller and clearer.

### 4.2 Dead Or Orphaned Code

Confirmed cleanup targets:

- empty folder: `berlin/src/projection`;
- unused `roleRank` in `identity/reconcile.ts`;
- unused `resolveActivePublishLocales` in `account-management/locales.ts`;
- unused `isRefreshGraceWindow` in `crypto/jwt.ts`;
- unused `parsePositiveInt` in `utils/claims.ts`;
- unnecessary exported `dec` in `crypto/encoding.ts`;
- route handlers exported only because of habit, not external use.

Required correction:

- Delete dead folders and helpers.
- Remove unnecessary exports unless a test or real module imports them.

### 4.3 Legacy And Pre-GA Toxicity

Confirmed residue:

- `ProviderIdentity.legacyUserId`;
- `p_legacy_user_id` in the login reconciliation RPC payload;
- silent `"New account"` fallback when post-login account creation omits a name.

Required correction:

- Remove legacy user ID from Berlin's product-facing provider identity model.
- If the database RPC still requires `p_legacy_user_id`, pass `null` from a named DB compatibility edge and record the DB cleanup as blocked follow-up.
- Make residual account creation fail invalid/missing account names.
- Preserve strict `direct_provider` session validation.
- Do not reintroduce Supabase Auth or password login.

### 4.4 Toxic Self-Checking Flows

These flows are product self-checking, not auth custody:

- account create writes, reloads principal account state, then verifies its own write;
- owner transfer writes, reloads principal account state, then verifies its own write;
- invitation accept writes membership/invitation/active preference, reloads principal account state, then verifies its own write.

Required correction:

- Remove or reduce read-after-write proof when it exists only to let Berlin validate its own residual product mutation.
- Return owner write results when possible.
- If response compatibility requires a refreshed account object, name it as residual response shaping, not canonical proof.

Do not remove legitimate auth custody checks:

- OAuth state consumption;
- finish-ticket consumption;
- refresh-token reuse detection;
- revoked-session checks;
- session subject mismatch checks.

### 4.5 Duplicate Implementations

Confirmed duplicate patterns:

- repeated `asTrimmedString`;
- repeated UUID validation;
- repeated role parsing;
- repeated `try/catch request.json()` blocks;
- repeated Supabase admin response/error envelope handling.

Required correction:

- Consolidate tiny boundary primitives only when it deletes duplication.
- Do not build a generic utility platform.
- Keep product-specific validation local.

### 4.6 Publish Containment Ambiguity

`publish-containment` inside Berlin is risky because the name implies publication authority.

Required correction:

- Prove it reads only account policy/containment state, not widget publish/live state.
- Delete it if no active product caller exists.
- If an active caller exists, keep behavior but make the code/documentation clear that Tokyo owns publish/live state.
- Do not rename public routes unless callers are updated in the same slice.

## 5. Execution Slices

Each slice must be green before the next starts.

### Slice 0 - Restore Execution Baseline

Purpose:

- Confirm no half-executed folder taxonomy or broken imports remain from aborted work.

Required checks:

```bash
git status --short berlin
find berlin/src -maxdepth 2 -type f -name '*.ts' | sort
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Acceptance:

- Berlin tree is the current runtime shape before simplification.
- Typecheck passes.
- No `auth-system` taxonomy folder exists unless it was already in `HEAD`.

### Slice 1 - No-Risk Dead Code Deletion

Scope:

- `berlin/src/projection`
- confirmed unused helpers and exports

Required changes:

1. Delete empty `berlin/src/projection`.
2. Delete unused `roleRank`.
3. Delete unused `resolveActivePublishLocales`.
4. Delete unused `isRefreshGraceWindow`.
5. Delete unused `parsePositiveInt`.
6. Make `dec` private or delete it if not needed.
7. Remove unnecessary route-handler exports only where no other file imports them.

Acceptance:

```bash
rg -n "roleRank|resolveActivePublishLocales|parsePositiveInt|isRefreshGraceWindow" berlin/src
find berlin/src -type d -empty -print
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Expected:

- deleted helper scan returns no active runtime definitions;
- no empty `projection` folder remains;
- typecheck passes;
- net LOC decreases.

### Slice 2 - Kill Legacy And Silent Fallback Behavior

Scope:

- `berlin/src/identity/reconcile.ts`
- `berlin/src/account-management/routes.ts`
- DB RPC compatibility note if needed

Required changes:

1. Remove `legacyUserId` from `ProviderIdentity`.
2. Remove product-level propagation of `legacyUserId`.
3. If `resolve_login_identity` still requires `p_legacy_user_id`, pass `null` from an explicitly named compatibility wrapper and document that DB cleanup is blocked.
4. Change residual `POST /v1/accounts` parsing so missing `name` fails validation instead of becoming `"New account"`.
5. Keep first-login provisioning default `"Personal"` only if explicitly scoped to first-login account landing.

Acceptance:

```bash
rg -n "legacyUserId|p_legacy_user_id|New account" berlin/src
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Expected:

- no product-facing legacy user ID concept;
- no silent residual account-name fallback;
- typecheck passes.

### Slice 3 - Active Caller Audit For Residual Account API

Scope:

- `berlin/src/account-management/**`
- `berlin/src/publish-containment/**`
- Roma/Bob callers

Required work:

1. Inventory every residual Berlin route and locate current Roma/Bob callers.
2. Mark routes as:
   - active residual;
   - no active caller, delete now;
   - blocked by unknown caller, stop and document.
3. Delete no-active-caller routes and their private helpers.
4. Do not rename folders in this slice.

Acceptance:

```bash
rg -n "/v1/me|/v1/accounts|publish-containment|contact-methods|owner-transfer|invitations" roma bob berlin/src --glob '!**/node_modules/**' --glob '!**/.next/**'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Expected:

- every kept residual route has an active caller or a documented blocker;
- dead residual routes are deleted;
- typecheck passes;
- net LOC decreases unless a blocker note is required.

### Slice 4 - Reduce Product Self-Checking

Scope:

- account creation;
- owner transfer;
- invitation acceptance.

Required changes:

1. Remove read-after-write checks that exist only to prove Berlin's own residual mutation.
2. Prefer returning write/RPC results.
3. Keep refreshed account response only where current caller contract requires it.
4. If kept, name the refresh as residual response shaping.
5. Do not touch auth custody checks.

Acceptance:

```bash
rg -n "created account missing from principal state|owner transfer account missing from refreshed principal state|accepted invitation account missing from principal state" berlin/src
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Expected:

- self-check error strings are gone or replaced by explicit residual response-shaping code;
- typecheck passes;
- behavior remains compatible for active callers.

### Slice 5 - Duplicate Primitive Consolidation

Scope:

- duplicate string/UUID/role/body parsing only.

Required changes:

1. Add at most one small boundary primitive file if it deletes more code than it adds.
2. Consolidate identical string trimming.
3. Consolidate identical UUID validation.
4. Consolidate identical role parsing where semantics are actually identical.
5. Replace repeated body parsing with one existing or small helper.
6. Do not add repository, ORM, domain service, or framework abstractions.

Acceptance:

```bash
rg -n "function asTrimmedString|let payload: unknown = null|request\\.json\\(\\)" berlin/src
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Expected:

- duplicate count materially decreases;
- new helper LOC is smaller than deleted duplicate LOC;
- typecheck passes.

### Slice 6 - Publish Containment Simplification

Scope:

- `berlin/src/publish-containment/**`
- active callers

Required changes:

1. Verify whether the route has active callers.
2. Delete it if there is no active caller.
3. If active, prove it reads only account policy/containment state.
4. Rename internal code only if it reduces ambiguity without changing public route contract.
5. Document Tokyo as the only publish/live owner.

Acceptance:

```bash
rg -n "publish-containment|account_publish_containment" roma bob berlin/src documentation --glob '!**/node_modules/**' --glob '!**/.next/**'
rg -n "widget_instances|publicId|publish state|serve state|saved config|l10n overlay|instance inventory" berlin/src documentation/services/berlin.md
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Expected:

- no Berlin runtime ownership of widget publish/live state;
- dead route deleted or active route documented as policy-only;
- typecheck passes.

### Slice 7 - Verification Floor Without Framework Bloat

Scope:

- `berlin/package.json`
- optional lightweight script under `scripts/` or `berlin/`

Required changes:

1. Add package-local `typecheck`.
2. Add a lightweight auth-boundary static check only if it is small and specific.
3. The check must reject reintroduction of:
   - Supabase Auth browser login;
   - password login;
   - legacy user ID product modeling;
   - privileged fallback account;
   - Berlin widget publish/live ownership.

Acceptance:

```bash
corepack pnpm --filter @clickeen/berlin typecheck
corepack pnpm --filter @clickeen/berlin run verify:auth-boundary
```

Expected:

- scripts pass;
- no heavyweight test framework added.

### Slice 8 - Minimal Naming Closure Only If It Shrinks

Purpose:

- Make surviving architecture clearer only after behavior was reduced.

Allowed:

- Rename a file if the old name actively hides surviving authority.
- Move a file only if it removes a misleading top-level domain after that domain was emptied or reduced.
- Add a short README to residual code only if routes remain active.

Forbidden:

- broad `auth-system` reshuffle before deletion;
- folder taxonomy changes that preserve all old behavior;
- route manifest/platform work that does not reduce toxic surface;
- moving files to manufacture an architecture win.

Acceptance:

- any rename/move has a concrete deletion or active-boundary reason;
- net LOC does not increase for naming alone;
- typecheck passes.

### Slice 9 - Documentation Truth Closure

Scope:

- `documentation/services/berlin.md`
- `documentation/architecture/AccountManagement.md` if ownership changed
- this PRD execution log

Required changes:

1. Update docs to reflect actual deleted behavior and remaining residual routes.
2. Do not document aspirational folder taxonomy.
3. Document any blocked DB/RPC compatibility cleanup.
4. Record final route fate table.

Acceptance:

- docs match runtime;
- no doc describes Berlin as a generic account-management backend;
- no doc describes removed auth modes as supported.

## 6. Completion Criteria

PRD 090 is complete only when:

1. confirmed dead code is deleted;
2. legacy user ID is not provider identity product truth;
3. residual account creation no longer silently defaults missing names;
4. no-active-caller residual routes are deleted;
5. active residual routes are explicitly justified;
6. product self-checking flows are removed or reduced;
7. duplicate primitives/body parsing are materially reduced;
8. Berlin does not own widget publish/live state;
9. package-local verification exists and passes;
10. docs match runtime;
11. net result is simpler by behavior and LOC, not just file names.

## 7. Final Required Verification

Run at closure:

```bash
corepack pnpm --filter @clickeen/berlin typecheck
corepack pnpm --filter @clickeen/berlin run verify:auth-boundary
corepack pnpm --filter @clickeen/roma build
git diff --check
```

Required static scans:

```bash
rg -n "supabase.auth|password login|password_login|postgrest|fallback account|privileged fallback|SUPABASE_AUTH|auth bridge|supabase bridge" berlin/src roma/src roma/app bob/lib documentation/services/berlin.md documentation/architecture/AccountManagement.md --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.wrangler/**'
rg -n "legacyUserId|New account|roleRank|resolveActivePublishLocales|parsePositiveInt|isRefreshGraceWindow" berlin/src --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.wrangler/**'
rg -n "widget_instances|publicId|publish state|serve state|saved config|l10n overlay|instance inventory" berlin/src documentation/services/berlin.md --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.wrangler/**'
```

Expected:

- removed concepts do not exist in active runtime code;
- allowed historical/documentation mentions are explicit removal notes;
- Berlin's behavior surface is smaller than before PRD 090.

## 8. Execution Log

### Slice 0 - Restore Execution Baseline

Status: Green
Date: 2026-05-11

Checks run:

```bash
git status --short berlin
find berlin/src -maxdepth 2 -type f -name '*.ts' | sort
find berlin/src -maxdepth 2 -type d | sort | rg 'auth-system|projection' || true
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Result:

- Berlin runtime code was clean before PRD 90 code execution.
- No `auth-system` taxonomy folder exists.
- `berlin/src/projection` is present as the known dead scaffold for Slice 1.
- Typecheck passed.

### Slice 1 - No-Risk Dead Code Deletion

Status: Green
Date: 2026-05-11

Files changed:

- `berlin/src/account-management/invitations.ts`
- `berlin/src/account-management/locales.ts`
- `berlin/src/account-management/routes.ts`
- `berlin/src/auth/routes.ts`
- `berlin/src/bootstrap/routes.ts`
- `berlin/src/crypto/encoding.ts`
- `berlin/src/crypto/jwt.ts`
- `berlin/src/identity/reconcile.ts`
- `berlin/src/publish-containment/routes.ts`
- `berlin/src/session/routes.ts`
- `berlin/src/utils/claims.ts`

Changes:

- Deleted empty `berlin/src/projection`.
- Deleted unused `roleRank`.
- Deleted unused `resolveActivePublishLocales`.
- Deleted unused `isRefreshGraceWindow`.
- Deleted unused `parsePositiveInt`.
- Made `dec` private to `crypto/encoding.ts`.
- Made route-table-only handlers local in route files.
- Made `listAccountInvitations` local.

Checks run:

```bash
rg -n "roleRank|resolveActivePublishLocales|parsePositiveInt|isRefreshGraceWindow" berlin/src -g'*.ts' || true
find berlin/src -type d -empty -print
rg -n "^export (async function handle|function handle)|^export async function listAccountInvitations|export const dec" berlin/src -g'*.ts' || true
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
git diff --stat -- berlin/src
```

Result:

- Confirmed dead helper scan returned no matches.
- Empty folder scan returned no matches.
- Remaining exported handlers are imported by other modules, not route-table-only exports.
- Typecheck passed.
- Net Berlin source diff for this slice: `33 insertions(+), 75 deletions(-)`.

### Slice 2 - Kill Legacy And Silent Fallback Behavior

Status: Green
Date: 2026-05-11

Files changed:

- `berlin/src/identity/reconcile.ts`
- `berlin/src/account-management/routes.ts`

Changes:

- Removed `legacyUserId` from Berlin's provider identity product model.
- Removed `p_legacy_user_id` from the `resolve_login_identity` RPC payload. The database argument has a default `NULL`, so no runtime compatibility parameter is needed.
- Changed residual account creation so a missing account name fails validation instead of silently becoming `"New account"`.

Checks run:

```bash
rg -n "legacyUserId|p_legacy_user_id|New account" berlin/src -g'*.ts' || true
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Result:

- Legacy/silent fallback scan returned no Berlin runtime matches.
- Typecheck passed.

### Slice 3 - Active Caller Audit For Residual Account API

Status: Green
Date: 2026-05-11

Files changed:

- `berlin/src/account-management/routes.ts`
- `berlin/src/account-management/members.ts`

Route decisions:

- Deleted `POST /v1/me/email-change`: no active Roma/Bob caller.
- Deleted exact `GET /v1/accounts`: no active Roma/Bob caller.
- Deleted exact `POST /v1/accounts`: no active Roma/Bob caller after first-login provisioning remains in the auth path.
- Deleted `POST /v1/accounts/:id/members`: no active Roma/Bob caller; team creation uses invitations.
- Deleted `POST /v1/accounts/:id/switch`: no active Roma/Bob caller.
- Kept active profile routes: `GET/PUT /v1/me`, `GET /v1/me/identities`, and contact-method verification routes.
- Kept active account routes: `GET/DELETE /v1/accounts/:id`, `PUT /v1/accounts/:id/locales`, team member read/update/delete, invitations, owner transfer, invitation acceptance, lifecycle tier-drop dismiss, and publish-containment.

Checks run:

```bash
rg -n "/v1/me|/v1/accounts|publish-containment|contact-methods|owner-transfer|invitations|email-change|lifecycle/tier-drop|/switch" roma bob berlin/src --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/.wrangler/**'
rg -n '(/v1/me/email-change|/switch|handleAccountMemberCreate|parseMemberCreatePayload|createAccountMember|handleAccountCreate|handleAccounts|handleAccountSwitch|handleMeEmailChange)' berlin/src -g'*.ts' || true
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Result:

- Every kept residual route has an active Roma caller.
- No-caller residual account surfaces and their private helpers were deleted.
- Deleted route/helper scan returned no matches.
- Typecheck passed.

### Slice 4 - Reduce Product Self-Checking

Status: Green
Date: 2026-05-11

Files changed:

- `berlin/src/account-management/governance.ts`
- `berlin/src/account-management/invitations.ts`
- `berlin/src/account-management/routes.ts`

Changes:

- Removed owner-transfer read-after-write principal reload. Roma redirects on success and does not require the refreshed account object.
- Removed invitation-acceptance read-after-write principal reload. Roma redirects on success and does not require the refreshed account object.
- Removed `sessionRole` plumbing that existed only to support those self-checking reloads.
- Returned direct mutation result identifiers instead of asking Berlin to prove its own mutation by reloading account state.

Checks run:

```bash
rg -n "created account missing from principal state|owner transfer account missing from refreshed principal state|accepted invitation account missing from principal state" berlin/src -g'*.ts' || true
rg -n "loadPrincipalAccountState|findAccountContext|sessionRole|claimAsString" berlin/src/account-management/governance.ts berlin/src/account-management/invitations.ts berlin/src/account-management/routes.ts
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Result:

- Self-check error-string scan returned no matches.
- `governance.ts` and `invitations.ts` no longer reload principal account state after successful writes.
- Remaining `findAccountContext` hits are boundary authorization checks in route handlers.
- Typecheck passed.

### Slice 5 - Duplicate Primitive Consolidation

Status: Green
Date: 2026-05-11

Files changed:

- `berlin/src/utils/primitives.ts`
- `berlin/src/account-management/governance.ts`
- `berlin/src/account-management/invitations.ts`
- `berlin/src/account-management/members.ts`
- `berlin/src/account-management/routes.ts`
- `berlin/src/auth/ticket-store.ts`
- `berlin/src/bootstrap/route-context.ts`
- `berlin/src/bootstrap/state.ts`
- `berlin/src/http/auth-request.ts`
- `berlin/src/identity/contact-methods.ts`
- `berlin/src/identity/profile-normalization.ts`
- `berlin/src/identity/reconcile.ts`
- `berlin/src/publish-containment/account-publish-containment.ts`

Changes:

- Added one small boundary primitive file for string trimming, UUID normalization, UUID checks, and JSON body reads.
- Deleted repeated local `asTrimmedString` and UUID helper definitions.
- Replaced repeated `try { request.json() } catch { null }` blocks where invalid JSON and invalid payload have the same contract.
- Kept the local locales JSON block because that endpoint intentionally returns `coreui.errors.payload.invalidJson`.

Checks run:

```bash
rg -n "function asTrimmedString|function isUuid|const UUID_PATTERN|let payload: unknown = null|request\\.json\\(\\)" berlin/src -g'*.ts'
rg -n "asTrimmedString\\(|normalizeUuid\\(|isUuid\\(|readJsonPayload\\(" berlin/src -g'*.ts'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Result:

- Duplicate primitive definitions were reduced to `berlin/src/utils/primitives.ts`.
- The only remaining direct `request.json()` block is the locales endpoint's distinct invalid-JSON contract.
- Typecheck passed.

### Slice 6 - Publish Containment Simplification

Status: Green
Date: 2026-05-11

Files changed:

- `documentation/services/berlin.md`

Decision:

- Kept `GET /v1/accounts/:id/publish-containment` because Roma's publish route actively calls it before Tokyo publish.
- Did not rename runtime code because the current name maps directly to the active public contract and no rename would reduce behavior.
- Documented the route as account policy only, not widget/publish state ownership.

Checks run:

```bash
rg -n "publish-containment|account_publish_containment" roma bob berlin/src documentation --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/.wrangler/**'
rg -n "widget_instances|publicId|publish state|serve state|saved config|l10n overlay|instance inventory" berlin/src documentation/services/berlin.md --glob '!**/node_modules/**' --glob '!**/.next/**'
nl -ba 'roma/app/api/account/instances/[instanceId]/publish/route.ts' | sed -n '1,90p'
corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit
```

Result:

- Active caller confirmed: Roma publish route calls Berlin containment before delegating publish to Tokyo.
- Berlin runtime only reads `account_publish_containment` for account-level block state and reason.
- Widget ownership terms are absent from Berlin runtime and appear in Berlin docs only as explicit non-ownership statements.
- Typecheck passed.

### Slice 7 - Verification Floor Without Framework Bloat

Status: Green
Date: 2026-05-11

Files changed:

- `berlin/package.json`
- `berlin/verify-auth-boundary.mjs`

Changes:

- Added package-local `typecheck`.
- Added a small static auth-boundary verifier scanning active Berlin/Roma/Bob runtime auth paths only.
- The verifier rejects Supabase Auth browser/product API usage, password login product paths, PostgREST product token paths, fallback account behavior, legacy user ID bridge text, and Berlin widget ownership markers.

Checks run:

```bash
corepack pnpm --filter @clickeen/berlin typecheck
corepack pnpm --filter @clickeen/berlin run verify:auth-boundary
node berlin/verify-auth-boundary.mjs
git diff --check -- berlin/package.json berlin/verify-auth-boundary.mjs
```

Result:

- Package-local typecheck passed.
- Auth-boundary verifier passed through pnpm and direct repo-root execution.
- Diff whitespace check passed.

### Slice 8 - Minimal Naming Closure Only If It Shrinks

Status: Green
Date: 2026-05-11

Decision:

- No rename or move was executed.
- Every remaining top-level Berlin source folder has active behavior after deletion slices.
- Renaming `publish-containment` or residual `account-management` code would not delete behavior, remove ambiguity, or reduce LOC in this slice.

Checks run:

```bash
find berlin/src -maxdepth 2 -type f -name '*.ts' | sort
corepack pnpm --filter @clickeen/berlin typecheck
```

Result:

- Naming-only churn avoided.
- Package-local typecheck passed.

### Slice 9 - Documentation Truth Closure

Status: Green
Date: 2026-05-11

Files changed:

- `documentation/services/berlin.md`
- `documentation/architecture/AccountManagement.md`
- `Execution_Pipeline_Docs/03-Executed/090__PRD__Berlin_World_Class_Auth_System.md`

Final route fate table:

- Kept permanent auth/session: `GET /auth/login/:provider/start`, `GET /auth/login/:provider/callback`, `POST /auth/finish`, `GET /auth/session`, `POST /auth/refresh`, `POST /auth/logout`, `GET /v1/session/bootstrap`, `GET /.well-known/jwks.json`, `GET /internal/healthz`.
- Kept residual active account/profile: `GET /v1/me`, `PUT /v1/me`, contact-method start/verify, `GET /v1/me/identities`, `GET /v1/accounts/:id`, `DELETE /v1/accounts/:id`, `PUT /v1/accounts/:id/locales`.
- Kept residual active team/invitation/governance: member read/update/delete, invitation list/create/delete, invitation accept, owner transfer, tier-drop dismiss.
- Kept active policy-only publish gate: `GET /v1/accounts/:id/publish-containment`.
- Deleted no-caller/toxic residual: `POST /v1/me/email-change`, exact `GET /v1/accounts`, exact `POST /v1/accounts`, direct `POST /v1/accounts/:id/members`, and `POST /v1/accounts/:id/switch`.

Checks run:

```bash
rg -n 'POST /v1/me/email-change|GET /v1/accounts$|POST /v1/accounts$|POST /v1/accounts/:id/members|POST /v1/accounts/:id/switch|auth-owned email-change|pending email change|New account|legacyUserId|p_legacy_user_id' documentation/services/berlin.md documentation/architecture/AccountManagement.md || true
rg -n "password login|Supabase Auth|PostgREST|generic account-management backend|widget instance inventory|saved config|publish state|l10n overlays" documentation/services/berlin.md documentation/architecture/AccountManagement.md
rg -n "exact\\('|pattern:" berlin/src/account-management/routes.ts berlin/src/publish-containment/routes.ts berlin/src/bootstrap/routes.ts berlin/src/auth/routes.ts berlin/src/session/routes.ts -g'*.ts'
corepack pnpm --filter @clickeen/berlin typecheck
corepack pnpm --filter @clickeen/berlin run verify:auth-boundary
git diff --check -- documentation/services/berlin.md documentation/architecture/AccountManagement.md Execution_Pipeline_Docs/03-Executed/090__PRD__Berlin_World_Class_Auth_System.md
```

Result:

- Stale deleted-route/doc support scan returned no matches in Berlin service and AccountManagement docs.
- Remaining Supabase Auth/password/PostgREST/widget-state documentation references are explicit non-ownership or removal statements.
- Runtime route scan matches the documented Berlin route surface.
- Package-local typecheck passed.
- Auth-boundary verifier passed.
- Diff whitespace check passed.

## 9. Final Verification

Date: 2026-05-11

Checks run:

```bash
corepack pnpm --filter @clickeen/berlin typecheck
corepack pnpm --filter @clickeen/berlin run verify:auth-boundary
NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/roma build
git diff --check
rg -n "supabase.auth|password login|password_login|postgrest|fallback account|privileged fallback|SUPABASE_AUTH|auth bridge|supabase bridge" berlin/src roma/app roma/lib bob/lib documentation/services/berlin.md documentation/architecture/AccountManagement.md --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.wrangler/**' || true
rg -n "legacyUserId|New account|roleRank|resolveActivePublishLocales|parsePositiveInt|isRefreshGraceWindow" berlin/src --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.wrangler/**' || true
rg -n "widget_instances|publicId|publish state|serve state|saved config|l10n overlay|instance inventory" berlin/src documentation/services/berlin.md --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.wrangler/**' || true
```

Result:

- Berlin package typecheck passed.
- Berlin auth-boundary verifier passed.
- Roma build passed with the required explicit Tokyo URL. A first build attempt without `NEXT_PUBLIC_TOKYO_URL` failed at Roma's existing configuration gate, then passed when rerun with `https://tokyo.dev.clickeen.com`.
- Diff whitespace check passed.
- Legacy/fallback static scan has no runtime hits; remaining matches are Berlin documentation statements that explicitly forbid or mark removed legacy behavior.
- Berlin toxic-helper scan returned no matches.
- Berlin widget-ownership scan has no runtime hits; remaining matches are Berlin documentation statements that Tokyo owns widget instance/config/localization/publish state.
