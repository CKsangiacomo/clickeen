# PRD 096 - Pre-GA Fragmentation Tax And Product-Path Cleanup

Status: Executed
Date: 2026-05-13
Source audit: `Execution_Pipeline_Docs/02-Executing/Clickeen_pre_GA_holistic_audit.md`
Architecture source: `documentation/architecture/CONTEXT.md`
Strategy source: `documentation/strategy/WhyClickeen.md`
Related observability: `Execution_Pipeline_Docs/01-Planning/095__PRD__Pre_GA_Observability_Minimums.md`
Venice authority: `Execution_Pipeline_Docs/01-Planning/097__PRD__Venice_World_Class_Public_Runtime.md`

## 1. Purpose

PRD 096 is the umbrella cleanup plan for the pre-GA fragmentation tax exposed by the holistic audit.

The architecture spine is correct: Roma is the current-account product boundary, Bob is the Builder authoring surface, Tokyo/Tokyo-worker own widget instance storage and derived artifacts, Venice serves public embeds, and Berlin owns account/session identity. The problem is not missing architecture. The problem is repeated local helpers, repeated route/client boilerplate, implicit reason-key contracts, and silent product-path failures.

This PRD moves the system toward fewer concepts, fewer duplicate truths, and a product path that is easier for humans and AI agents to reason about.

## 2. Product Truth

The real product path remains:

1. A real account opens one widget instance in Roma.
2. Roma opens Bob through the host-only account Builder path.
3. Bob edits one active-locale working copy in memory.
4. Roma saves that account instance to Tokyo-worker.
5. Tokyo-worker owns saved config, publish state, derived artifacts, and public-read eligibility.
6. Venice serves only published public runtime artifacts.

No sub-PRD may preserve fake product modes, demo identities, fallback product truth, or duplicate authorities.

## 3. Non-Negotiable Execution Rules

- Deletion-first: every sub-PRD must name what gets deleted before naming what gets added.
- No mega-commit: one PR per sub-PRD, one commit per green slice, no squash on merge.
- No new packages.
- No route DSL, route framework, schema validation layer, universal `AppError` hierarchy, or global `Result<T, ReasonKey>` pattern.
- No observability implementation in PRD 096; that is PRD 095.
- No Venice loader/runtime work in PRD 096; that is PRD 097.
- No broad San Francisco agent layout refactor in PRD 096.
- No modification to `packages/l10n/src/index.ts`.
- Primitive migration slices must not touch `berlin`, `sanfrancisco`, `dieter`, or `packages/ck-policy` source files.
- Lint/enforcement gates land only after the cleanup they enforce is merged and verified green.
- "Use existing helper" means "use the canonical helper." If the canonical helper has a different return contract than the local copy, the work is a contract migration, not a rename.
- If any single slice adds more than roughly 150 LOC net, the slice is wrong-shaped. Stop and split.

## 4. Agreed Architecture Direction

### 4.1 Elegant Engineering And Scalability

The elegant fix is to consolidate repeated primitives and repeated boundary calls into small boring authorities:

- `@clickeen/ck-contracts` owns shared primitives that are safe for cross-service use.
- Roma uses one small Tokyo product-control call primitive for saved-config CRUD instead of hand-writing the same upstream fetch pattern repeatedly.
- Roma routes stay readable top-to-bottom and use only tiny helpers where repetition is mechanical.
- Reason keys become importable typed constants, not newly invented strings in every touched file.
- Product-path silent failures become named/logged boundary events once PRD 095's observability primitives exist.

### 4.2 Tenet Compliance

This plan supports the current tenets:

- Product truth before code topology: callers are not proof that duplicate helpers or fake flows should survive.
- Fail at named boundary: silent nulls on product paths become named failures or logged optional misses.
- Orchestrators are dumb pipes: Roma forwards account product operations to Tokyo-worker without carrying its own duplicate instance truth.
- No fallbacks as product truth: missing current state fails at the boundary instead of inventing a softened runtime state.
- Documentation is truth: each sub-PRD updates architecture docs only when behavior or boundary ownership changes.

### 4.3 Overarchitecture To Avoid

This PRD explicitly rejects:

- `defineRomaRoute(...)` or any equivalent route DSL.
- `withCurrentAccount(...)` in the first route-helper slice.
- A generic proxy platform for Berlin/Tokyo.
- A schema-validation abstraction for Roma routes.
- A universal error class system.
- A repo-wide `Result` rewrite.
- New packages for theoretical purity.
- San Francisco provider/session/layout consolidation unless a concrete product-path bug later requires one narrow helper.

### 4.4 Academic / Meta / Gold-Plating To Avoid

Out of scope:

- Quarterly PRD culls.
- Backlog archaeology.
- Process docs.
- AI agent runtime theory.
- Broad "make everything consistent" rewrites.
- New abstractions that add more LOC than they delete.

## 5. Sub-PRDs

### PRD 096A.1 - Product-Path Primitive Drift Cleanup

Execution status: Complete.

Executed changes:

- Added canonical `decodeJwtPayload` and `tokenIsExpired` exports to `@clickeen/ck-contracts`.
- Deleted scoped duplicate `isRecord` / `isPlainRecord` / `isPlainObject` / `asTrimmedString` helpers in Roma, Tokyo-worker, Bob, and Prague where `ck-contracts` is dependency-safe.
- Replaced Roma session JWT decode/expiry helpers with the canonical `ck-contracts` exports.
- Preserved the canonical `asTrimmedString` `string | null` contract; callers that need empty-string behavior now express that explicitly at the call site.

Verification:

- `corepack pnpm --filter @clickeen/ck-contracts typecheck` - green
- `corepack pnpm --filter @clickeen/roma typecheck` - green
- `corepack pnpm --filter @clickeen/tokyo-worker typecheck` - green
- `corepack pnpm --filter @clickeen/bob typecheck` - green
- `corepack pnpm --filter @clickeen/prague typecheck` - green, with existing Astro-generated hints only
- `corepack pnpm --filter @clickeen/ck-contracts lint` - green
- `corepack pnpm --filter @clickeen/roma lint` - green
- `corepack pnpm --filter @clickeen/bob lint` - green
- `corepack pnpm --filter @clickeen/ck-contracts test` - green
- `corepack pnpm --filter @clickeen/bob test` - green, no tests discovered
- Duplicate primitive scan now reports only the canonical `ck-contracts` definitions for the targeted helper names.
- `git diff --check` on the 096A.1 touched files - green

Out-of-scope confirmation:

- 096A.1 did not modify `packages/l10n/src/index.ts`, `packages/ck-policy`, `berlin`, `sanfrancisco`, or `dieter` source files.

Goal: make `@clickeen/ck-contracts` the canonical authority for repeated product-path primitives.

Scope:

- `packages/ck-contracts`
- `roma`
- `tokyo-worker`
- `bob`
- `prague/src/lib/widgetCatalog.ts`

Deletion targets:

- Product-path local `isRecord` / `isPlainRecord` / `isPlainObject` copies where `ck-contracts` can be imported safely.
- Product-path local `asTrimmedString` copies where the canonical `string | null` contract is correct.
- Roma JWT decode / expiry helpers, replaced by canonical `decodeJwtPayload` and `tokenIsExpired` exports from `ck-contracts`.

Explicitly out of scope:

- `berlin`
- `sanfrancisco`
- `dieter`
- `packages/ck-policy`
- `packages/l10n/src/index.ts`
- `sha256Hex` cycle-breaking
- New package creation

Contract rule:

- Do not cast `null` to `string` to preserve local behavior.
- If a local helper returned `""` and the canonical helper returns `null`, migrate the caller's validation branch honestly.

Acceptance:

- Scoped product-path packages import canonical primitives where dependency-safe.
- Any remaining duplicate in the scoped files is documented inline with the concrete cycle or runtime reason.
- No `berlin`, `sanfrancisco`, `dieter`, `packages/ck-policy`, or `packages/l10n/src/index.ts` source file appears in the diff.
- Targeted typecheck/lint/test commands are green for touched packages.

### PRD 096A.2 - Primitive Drift Enforcement

Execution status: Complete.

Executed changes:

- Added `scripts/verify/primitive-drift.mjs`.
- Wired the primitive drift guard into root `pnpm lint` before Turbo lint.
- The guard scans the PRD 096A.1 cleaned surfaces and permits canonical definitions only in `packages/ck-contracts/src/index.ts`.
- The guard fails with: `Use canonical primitives from @clickeen/ck-contracts instead of adding local copies.`
- Did not expand scope to deferred services or packages:
  - `berlin`
  - `sanfrancisco`
  - `dieter`
  - `packages/ck-policy`
  - `packages/l10n/src/index.ts`

Gate evidence before execution:

- `corepack pnpm build:widgets:check` - green
- `node scripts/health/product-path-smoke.mjs --public-only --instance-id ins_01KR8R6ZYZZNDEZA0R8KCSWEEG --json` - green
- Full authenticated cloud-dev smoke was not runnable from this shell because `CK_ROMA_COOKIE` / `ROMA_COOKIE` was not present; this slice is enforcement-only and does not touch runtime product behavior.

Verification:

- `node --check scripts/verify/primitive-drift.mjs` - green
- `node scripts/verify/primitive-drift.mjs` - green
- `PATH="$PWD/.tmp-bin:$PATH" corepack pnpm lint` with a local `pnpm` wrapper for Turbo's package-manager lookup - green
- `corepack pnpm --filter @clickeen/bob lint` - green
- `corepack pnpm --filter @clickeen/roma lint` - green
- `git diff --check` on the 096A.2 touched files - green

Goal: prevent primitive drift from returning after 096A.1 is green.

Deletion targets:

- None. This is enforcement only after cleanup.

Additions:

- `no-restricted-syntax` or equivalent lint guard preventing new local `isRecord`, `isPlainRecord`, `isPlainObject`, and duplicate canonical primitive definitions outside approved packages.

Sequencing:

- Lands only after 096A.1 is merged and verified green: targeted typecheck passes, cloud-dev reachability smoke passes, and architecture gates pass.

Acceptance:

- Enforcement lands after 096A.1.
- Root lint remains green.
- The rule message points agents to the canonical import.

### PRD 096B - Roma Tokyo Saved-Config Client Consolidation

Execution status: Complete.

Executed changes:

- Added `roma/lib/tokyo-client.ts` with `TokyoCallContext` and a bounded `callTokyo<T>` helper for Roma -> Tokyo product-control calls.
- Kept `roma/lib/tokyo-client.ts` at 106 LOC, below the roughly 200 LOC ceiling.
- Reused `buildTokyoProductControlHeaders` and `fetchTokyoProductControl` from `roma/lib/tokyo-product-control.ts`.
- Moved only the five saved-config wrappers through `tokyo-client.ts`:
  - `loadSavedInstanceFromTokyo`
  - `writeSavedConfigToTokyo`
  - `saveAccountInstanceInTokyo`
  - `duplicateAccountInstanceInTokyo`
  - `deleteAccountInstanceFromTokyo`
- Left create, publish/unpublish lifecycle, serve-state, index, catalog, and document-read orchestration in `account-instance-direct.ts`.
- Did not add a generic proxy platform, route framework, schema layer, error class hierarchy, or global `Result<T, ReasonKey>` pattern.

Verification:

- `corepack pnpm --filter @clickeen/roma typecheck` - green
- `corepack pnpm --filter @clickeen/roma lint` - green
- `NEXT_PUBLIC_TOKYO_URL=http://localhost:8787 corepack pnpm --filter @clickeen/roma build` - green
- `git diff --check` on the 096B touched files - green
- Scoped scan confirms exactly five `callTokyo(...)` call sites in `account-instance-direct.ts`.
- Scoped scan confirms create, publish/unpublish lifecycle, serve-state, index, and catalog wrappers still use the existing explicit `fetchTokyoJson(...)` path.

Goal: shrink `roma/lib/account-instance-direct.ts` by replacing repeated saved-config CRUD upstream boilerplate with one typed Tokyo product-control call primitive.

Deletion targets:

- Repeated saved-config CRUD wrapper boilerplate for:
  - `writeSavedConfigToTokyo`
  - `saveAccountInstanceInTokyo`
  - `loadSavedInstanceFromTokyo`
  - `duplicateAccountInstanceInTokyo`
  - `deleteAccountInstanceFromTokyo`

Allowed addition:

- New `roma/lib/tokyo-client.ts`, kept under roughly 200 LOC.
- `callTokyo<T>(ctx, { path, method, body?, decode, errorKey })`
- `TokyoCallContext` containing account id, account capsule, and optional internal service name.
- Reuse existing header construction from `roma/lib/tokyo-product-control.ts`; do not create a generic transport layer.

Explicitly out of scope:

- Publish/unpublish lifecycle wrappers.
- Index, serve-state, catalog, and instance-document reads.
- Generic proxy platform.
- Behavior changes to publish/unpublish/open/save semantics.

Sequencing:

- Lands after PRD 095 observability exists.

Acceptance:

- Only the five saved-config CRUD wrappers move through `tokyo-client.ts`.
- Lifecycle and read wrappers remain in `account-instance-direct.ts`.
- Open, save, duplicate, delete, and saved-config read behavior is preserved.
- Roma typecheck/build verification is green.

### PRD 096C - Roma Route Helper Cleanup

Execution status: Complete.

Executed changes:

- Added `roma/lib/route-helpers.ts` with exactly two helpers:
  - `requireInstanceIdParam`
  - `readJsonPayloadOrValidation`
- Migrated repeated instance-id validation blocks in account instance routes and Builder open.
- Migrated repeated JSON parse invalid-envelope blocks in create, save, rename, and locale-write routes.
- Kept field-level validation inline in each route.
- Left the copilot request body parse behavior intact because those routes intentionally preserve the current copilot 200-response UX contract.
- Did not touch `roma/lib/account-assets-gateway.ts`.
- Did not add `withCurrentAccount`, `defineRomaRoute`, a schema layer, or any route framework.

Verification:

- `corepack pnpm --filter @clickeen/roma typecheck` - green
- `corepack pnpm --filter @clickeen/roma lint` - green
- Anti-framework scan on touched files found no `defineRomaRoute`, `withCurrentAccount`, schema libraries, `jsonValidation`, or asset-gateway merge.
- Repeated-boilerplate scan shows only the two intentionally preserved copilot `.json().catch(() => null)` paths.
- `git diff --check` on the 096C touched files - green

Goal: reduce repeated route boilerplate without hiding route behavior behind a framework.

Deletion targets:

- Repeated route param trim/empty validation blocks.
- Repeated JSON body parse invalid-envelope blocks.

Allowed additions:

- `requireInstanceIdParam(context)` returning `string | RouteFailure`.
- `readJsonPayloadOrValidation(request)` returning `{ ok: true, payload } | RouteFailure` with `coreui.errors.payload.invalidJson` on parse failure.

Explicitly out of scope:

- `withCurrentAccount`
- `defineRomaRoute`
- Declarative route schemas
- Generic `jsonValidation(payload, schema)`
- Account gateway merging
- `roma/lib/account-assets-gateway.ts`

Acceptance:

- Routes remain readable top-to-bottom.
- Field-level validation stays inline in route handlers.
- Account assets keep their current auth boundary and Tokyo asset-control headers.
- Roma typecheck/build verification is green.

### PRD 096E - Reason-Key Registry

Execution status: Complete.

Executed changes:

- Added `packages/ck-contracts/src/reason-keys.ts`.
- Added `ReasonKey`, `REASON_KEY_VALUES`, `REASON_KEYS`, and `REASON_KEY_GROUPS`.
- Exported the registry from `@clickeen/ck-contracts`.
- Kept the slice additive: no current emitter strings were mass-migrated.
- Did not introduce an error framework, `AppError` hierarchy, `.toResponse()` objects, schema layer, or global `Result<T, ReasonKey>` pattern.

Extraction note:

- The registry contains 125 static source-owned emitted reason-key strings found in active source files.
- Docs, build output, generated Tokyo artifacts, and dynamic template keys such as `HTTP_${status}` are intentionally excluded.

Verification:

- `corepack pnpm --filter @clickeen/ck-contracts typecheck` - green
- `corepack pnpm --filter @clickeen/ck-contracts lint` - green
- `corepack pnpm --filter @clickeen/ck-contracts test` - green
- Anti-framework scan on the registry found no `AppError`, `.toResponse()`, `Result<...>`, route framework, or schema-library additions.
- `git diff --check` on the 096E touched files - green

Goal: make reason keys typed and importable without introducing an error framework.

Deletion targets:

- None in the first registry commit. This starts additive.

Allowed additions:

- `packages/ck-contracts/src/reason-keys.ts`
- `ReasonKey` union covering the current emitted reason-key string set.
- `REASON_KEYS` const object.
- `REASON_KEY_GROUPS` const object for documentation and Prague/Core UI translation coverage checks.

Not allowed:

- `AppError` class hierarchy.
- `.toResponse()` error objects.
- A universal error abstraction.
- Mass migration of current literals.

Migration rule:

- From the registry landing date forward, touched/new emitter code must use the registry.
- Existing literals migrate opportunistically when their host file is touched for another reason.

Acceptance:

- Existing string values remain stable.
- Registry is additive and behavior-neutral.
- Touched/new reason keys are imported from the registry.
- No mass migration of the current reason-key literals occurs in this PRD.

### PRD 096F - Named Silent-Failure Fixes

Execution status: Complete.

Executed changes:

- `tokyo-worker/src/routes/internal-render-routes.ts`
  - Replaced the eight internal `req.json().catch(() => null)` sites with `readInternalRenderJsonBody(...)`.
  - Malformed internal JSON still returns the existing validation response, but now emits a structured `boundary.parse_failed` warning with request id, boundary, account id, and instance id where available.
- `berlin/src/auth/ticket-store.ts`
  - Replaced hidden ticket Durable Object response JSON parse failures with `readTicketStoreJson(...)`.
  - Preserved current ticket outcomes while logging structured `boundary.operation_failed` warnings for malformed ticket-store responses.
  - Left alarm/delete maintenance side-effect catches as explicit `undefined` cleanup paths; they do not alter issued or consumed ticket truth.
- `roma/lib/account-instance-direct.ts`
  - Replaced the remaining direct Tokyo response JSON parse swallow in `fetchTokyoJson(...)` with a structured Roma warning.
  - Preserved current upstream fallback behavior and response mapping.
- `prague/src/lib/pragueL10n.ts`
  - Logged Tokyo l10n fetch failures, non-404 HTTP failures, JSON parse failures, and unexpected overlay helper failures before preserving the existing `null`/missing/stale behavior.
  - Kept 404 overlay/index/base snapshot misses as intentional optional/cache-miss paths.
- `packages/ck-contracts/src/observability.ts`
  - Added `prague` to the observed-service union so Prague l10n warnings use the same structured log event contract.
- `venice/app/widget/[instanceId]/route.ts`
  - No code change in this slice. The remaining catches are inside the shipped browser shell and already surface visible widget errors to the iframe. Server-side artifact resolution and removal of the client boot waterfall belong to PRD 097.

Verification:

- `corepack pnpm --filter @clickeen/ck-contracts typecheck` - green
- `corepack pnpm --filter @clickeen/ck-contracts lint` - green
- `corepack pnpm --filter @clickeen/ck-contracts test` - green
- `corepack pnpm --filter @clickeen/tokyo-worker typecheck` - green
- `corepack pnpm --filter @clickeen/berlin typecheck` - green
- `corepack pnpm --filter @clickeen/berlin verify:auth-boundary` - green
- `corepack pnpm --filter @clickeen/roma typecheck` - green
- `corepack pnpm --filter @clickeen/roma lint` - green
- `NEXT_PUBLIC_TOKYO_URL=http://localhost:8787 corepack pnpm --filter @clickeen/roma build` - green
- `corepack pnpm --filter @clickeen/prague typecheck` - green with existing generated Astro hints
- `corepack pnpm --filter @clickeen/prague build` - green
- `git diff --check` on the 096F touched files - green
- Named-file scan shows no remaining unlogged server-side `.catch(() => null)` in Tokyo-worker, Berlin, Roma, or Prague.
- Remaining Berlin `.catch(() => undefined)` sites are ticket alarm/delete cleanup side effects.
- Remaining Prague catches log before returning `null`.
- Remaining Venice catches are client-shell visible-error paths deferred to PRD 097.

Goal: remove silent failure from a small named set of product-path boundaries.

This is not a repo-wide sweep.

Named files:

- `tokyo-worker/src/routes/internal-render-routes.ts`
- `berlin/src/auth/ticket-store.ts`
- `venice/app/widget/[instanceId]/route.ts`
- `roma/lib/account-instance-direct.ts`
- `prague/src/lib/pragueL10n.ts`

Action:

- Replace product-path `.catch(() => null)` sites with structured `logError(...)` calls where the failure hides an upstream or storage failure.
- Preserve optional/cache-miss `null` returns only when they are explicitly optional and do not hide product truth.
- Do not introduce `console.error` as the logging mechanism.
- Do not convert these sites to a broad `Result<T, ReasonKey>` pattern.

Sequencing:

- Lands after PRD 095 provides the structured logger shape/adapters.

Acceptance:

- Only the named files are in scope.
- Each changed site either logs a named boundary failure or is documented as an intentional optional/cache-miss path.
- No fallback product truth is introduced.
- Touched package checks are green.

## 6. Sequencing

Can land first or in parallel:

- PRD 095
- PRD 096A.1
- PRD 096C
- PRD 096E

Must wait:

- PRD 096B waits for PRD 095.
- PRD 096F waits for PRD 095.
- PRD 096A.2 waits for PRD 096A.1 to be merged and verified green.

If PRD 095 slips, PRD 096B and PRD 096F slip with it.

## 7. Verification Discipline

Each sub-PRD must list exact local verification commands before execution. At minimum:

- Touched package typecheck.
- Touched package lint where present.
- Touched package tests where present.
- Product-path smoke for any Bob/Roma/Tokyo behavior change.

If a sub-PRD step is not green, do not move to the next step.

## 8. Commit Discipline

- One PR per sub-PRD.
- One commit per green slice inside the PR.
- No squash on merge.
- No "fix:" cleanup commits inside a PR; amend/rebase the slice commit until it is green.
- PR description must list each planned slice and the commit SHA that closes it.
- Do not add a CI commit-count gate yet; reviewers enforce the slice/commit list visually.

## 9. Explicit Deferrals

- PRD 095 owns observability minimums.
- PRD 097 owns all Venice runtime work, including loader cleanup, console-warning debug gating, SSR, loader split, cache policy, SEO/GEO delivery, and cross-browser verification.
- San Francisco `runAgent()` consolidation is deferred unless a concrete product-path bug requires a narrow helper.
- Documentation culling is deferred.
- New package creation is deferred.
- `packages/l10n/src/index.ts` hash duplication is intentionally not addressed. Revisit only if a future PRD has a real product reason to break the dependency cycle, and that future work gets its own RFC.

## 10. Separate Non-PRD Hotfix

The Venice embed loader currently has default `console.warn` output in the customer page. That is not PRD 096 work.

If handled before PRD 097, the only allowed hotfix is:

- Gate the current `console.warn` calls behind an explicit debug flag such as `data-ck-debug="true"` or a dedicated development loader path.
- Do not redesign the loader.
- Do not change SEO/GEO behavior.
- Do not add a bundler.

## 11. Final Intent

PRD 096 should make Clickeen more boring.

The correct end state is not a more sophisticated codebase. It is a smaller one with fewer duplicate helpers, fewer duplicate route/client patterns, fewer implicit strings, and fewer silent product-path failures.
