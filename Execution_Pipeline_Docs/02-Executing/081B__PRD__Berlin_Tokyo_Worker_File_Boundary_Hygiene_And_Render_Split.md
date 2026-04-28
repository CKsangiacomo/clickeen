# 081B PRD - Berlin/Tokyo Worker File Boundary Hygiene And Render Split

Status: READY FOR EXECUTION
Owner: Berlin, Tokyo-worker
Priority: P1
Date: 2026-04-28

## 1. Product Truth

This PRD is not a product feature.

It exists because Berlin and Tokyo-worker are core runtime services, and their file boundaries should make the product easier to reason about:

- Berlin owns auth, account bootstrap, account membership, account registry, and account governance.
- Tokyo-worker owns account-first storage, assets, saved render state, localization state, and public/live render projection.
- Roma/Bob account Builder remains the product path.

The goal is not to reduce file count for vanity. The goal is to remove fake boundaries, make surviving boundaries obvious, and split genuine monoliths where one file hides multiple authorities.

## 2. Problem

Recent review found two different kinds of code shape problems:

1. **Tiny files that are not real boundaries**
   - They mostly forward one helper or extend an adjacent module.
   - They add import hops without explaining ownership.

2. **A real monolith**
   - `tokyo-worker/src/domains/render.ts` is about 1,400 lines.
   - It mixes render types, R2 key conventions, pointer normalization, saved config reads/writes, l10n pack writing, live surface sync, queue job validation, and cleanup.
   - This is a genuine cognitive and execution risk.

There are also tempting false positives:

- A type-only module can be a valid boundary.
- A shared normalizer used by multiple product paths can be a valid boundary.
- A request-auth parser should not be dumped into a generic helper file if generic helpers are already too mixed.

## 3. Non-Negotiable Tenets

1. **No File-Count Crusade**
   - Do not merge or delete a file just because it is small.
   - A file is deleted only when its surviving authority is named.

2. **No Runtime Behavior Drift**
   - This PRD must not change auth behavior, account bootstrap shape, Tokyo storage keys, render output, l10n readiness, or public serving semantics.

3. **No New Abstraction Framework**
   - No generic service layer.
   - No dependency injection framework.
   - No new shared package for this cleanup.

4. **Delete Fake Boundaries, Preserve Real Ones**
   - Barrels with no package/public API value are deletion candidates.
   - Type-only boundaries used by many modules are allowed to stay.
   - Shared normalizers used by multiple real flows are allowed to stay.

5. **Small Cleanups Before Big Split**
   - Execute low-risk merges/deletions first.
   - Split `render.ts` only after the small cleanup is green.

## 4. Scope

In scope:

- Berlin helper/file boundary cleanup.
- Tokyo-worker HTTP/request utility cleanup.
- Tokyo-worker account-localization barrel deletion.
- Tokyo-worker `render.ts` split into focused modules.
- Documentation updates when runtime ownership language changes.

Out of scope:

- New product behavior.
- Supabase schema changes.
- D1 migration work.
- Roma/Bob UI changes.
- San Francisco l10n generation changes.
- Prague localization changes.
- Any deploy workflow changes.

## 5. Current Findings And Decisions

### 5.1 Berlin

#### Merge: `supabase-list.ts` into `supabase-admin.ts`

Decision: **Do it.**

Reason:

- `supabase-list.ts` is only an admin PostgREST pagination helper.
- Its authority is Supabase admin access.
- Keeping it separate adds little.

Target:

- Move `readSupabaseAdminListAll` into `berlin/src/supabase-admin.ts`.
- Delete `berlin/src/supabase-list.ts`.
- Update imports in:
  - `account-state.ts`
  - `account-invitations.ts`
  - `account-instance-registry.ts`
  - `account-reconcile.ts`

#### Split: `helpers.ts` into HTTP and token/binary helpers

Decision: **Do it, carefully.**

Reason:

- `helpers.ts` mixes response factories (`json`, `authError`, `validationError`) with JWT/base64/binary utilities (`enc`, `toBase64Url`, `fromBase64Url`, claim helpers).
- Berlin should mirror Tokyo/San Francisco naming where possible: `http.ts` for HTTP response helpers.

Target:

- Create `berlin/src/http.ts` for:
  - `json`
  - `authError`
  - `validationError`
  - `conflictError`
  - `internalError`
  - `methodNotAllowed`
  - `redirect`
- Keep `berlin/src/helpers.ts` for:
  - `enc`, `dec`
  - `asBearerToken`
  - PEM/base64url/array-buffer helpers
  - claim helpers
  - `parsePositiveInt`
  - `audienceMatches`
- Update imports by usage.
- Do not create circular imports.

#### Do Not Fold: `account-state.types.ts`

Decision: **Do not fold in this PRD.**

Reason:

- It is imported by many Berlin modules.
- Folding it into `account-state.ts` would make type-only consumers point at a large runtime module.
- It is a valid boundary.

#### Do Not Fold Blindly: `profile-normalization.ts`

Decision: **Do not fold in this PRD.**

Reason:

- It is used by `account-state.ts`, `user-profiles.ts`, and `account-reconcile.ts`.
- It is a shared user-profile normalizer, not a one-off helper.

#### Defer: `account-lifecycle.ts`

Decision: **Defer unless the route ownership is already touched.**

Reason:

- It is small, but it is a named account lifecycle action.
- Folding it into `account-governance.ts` is reasonable, but not needed for the first cleanup slice.
- Do not churn account governance behavior just to remove one file.

#### Do Not Dump: `auth-request.ts` into `helpers.ts`

Decision: **Keep as request-auth parsing boundary for now.**

Reason:

- It parses cookies/body/bearer access and refresh tokens.
- Moving it into generic helpers would make `helpers.ts` more mixed, not less.
- A future rename to `auth-http.ts` can be considered, but is not required here.

### 5.2 Tokyo-worker

#### Merge/Rename: `http.ts` + `request-ops.ts`

Decision: **Do it.**

Reason:

- `http.ts` only exports `json`.
- `request-ops.ts` owns request context, CORS, response finalization, and logging.
- Together they are the Tokyo HTTP boundary.

Target:

- Move `json` into `tokyo-worker/src/request-ops.ts`, then rename that module to `tokyo-worker/src/http.ts`.
- Delete the old tiny `tokyo-worker/src/http.ts`.
- Update imports from `./request-ops` and `./http` to the surviving `./http`.
- Keep existing behavior and headers byte-for-byte unless typecheck proves an unavoidable import-only change.

#### Delete: `domains/account-localization.ts` barrel

Decision: **Do it.**

Reason:

- Tokyo-worker is not a published package.
- The barrel hides which module owns which account-l10n behavior.

Target:

- Replace imports from `./domains/account-localization` with direct imports from:
  - `account-localization-state`
  - `account-localization-utils`
  - `account-localization-mirror`
- Delete `tokyo-worker/src/domains/account-localization.ts`.

#### Do Not Blindly Fold: `account-localization-utils.ts`

Decision: **Partial extraction only if touched by direct imports.**

Reason:

- Some helpers are domain-specific (`filterAllowlistedOps`, `normalizeReadyLocales`, `normalizeAllowlistEntries`).
- Some helpers are generic-ish (`asTrimmedString`, `isRecord`, `parseBearerToken`).
- A blind fold into `account-localization-state.ts` would make state own route parsing and generic shape helpers.

Target:

- Keep it unless the direct import cleanup reveals a smaller obvious split.
- No behavior churn.

#### Split: `domains/render.ts`

Decision: **Do it as the main structural work.**

Reason:

- `render.ts` is the one genuine monolith.
- It should read like Tokyo’s render/storage contract, not a single file with every concern.

Target module shape:

```txt
tokyo-worker/src/domains/render/
  types.ts          // render pointer/job/state types only
  keys.ts           // R2 key builders and public base URL helpers
  pointers.ts       // pointer normalization and saved pointer reads/writes
  saved-config.ts   // saved config read/write/delete + base/l10n state helpers
  packs.ts          // config/text/meta pack writing
  live-surface.ts   // sync/enforce/delete live surface
  queue-jobs.ts     // TokyoMirrorQueueJob validation/enqueue
  index.ts          // small explicit exports only
```

Acceptable variation:

- If an exact split creates cycles, adjust module names, but preserve the concern boundaries.
- `index.ts` is allowed here because `render/` becomes a directory module with explicit owned exports. This is different from a cross-domain barrel.

Must preserve exports currently consumed by:

- `tokyo-worker/src/types.ts`
- `tokyo-worker/src/queue-handler.ts`
- `tokyo-worker/src/routes/render-routes.ts`
- `tokyo-worker/src/routes/internal-render-routes.ts`
- `tokyo-worker/src/domains/l10n-read.ts`
- `tokyo-worker/src/domains/l10n-authoring.ts`
- `tokyo-worker/src/domains/account-localization-state.ts`
- `tokyo-worker/src/domains/account-instance-sync.ts`
- `tokyo-worker/src/domains/public-instance.ts`

No storage key changes are allowed during this PRD. Because PRD 81A runs first, this means: preserve the post-81A storage contract exactly. Do not reintroduce pre-81A asset-version keys while moving render code.

## 6. Execution Plan

### Step 0 - Freeze Baseline

Run and save baseline facts:

```bash
git status --short
rg -n "from './helpers'|from './http'|from './request-ops'|from './domains/account-localization'|from '../domains/render'|from './render'" berlin/src tokyo-worker/src
wc -l berlin/src/helpers.ts tokyo-worker/src/domains/render.ts tokyo-worker/src/request-ops.ts tokyo-worker/src/http.ts
./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Green means the starting point is known and typecheck is clean before edits.

### Step 1 - Berlin Supabase Admin Merge

Implement:

- Move `readSupabaseAdminListAll` into `supabase-admin.ts`.
- Delete `supabase-list.ts`.
- Update imports.

Verify:

```bash
rg -n "supabase-list" berlin/src
./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit
```

Green means there are no `supabase-list` imports and Berlin typecheck passes.

### Step 2 - Berlin HTTP Helper Split

Implement:

- Add `berlin/src/http.ts`.
- Move response helpers from `helpers.ts` to `http.ts`.
- Update imports by actual usage.
- Keep token/binary/claim helpers in `helpers.ts`.

Verify:

```bash
rg -n "json|authError|validationError|conflictError|internalError|methodNotAllowed|redirect" berlin/src/helpers.ts
rg -n "enc|dec|toBase64Url|fromBase64Url|claimAsString|claimAsNumber|asBearerToken" berlin/src/http.ts
./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit
```

Green means HTTP helpers no longer live in `helpers.ts`, binary/token helpers do not live in `http.ts`, and Berlin typecheck passes.

### Step 3 - Tokyo HTTP Boundary Merge

Implement:

- Move `json` into the Tokyo request operations module.
- Rename/survive as `tokyo-worker/src/http.ts`.
- Delete `tokyo-worker/src/request-ops.ts`.
- Update imports.

Verify:

```bash
rg -n "request-ops" tokyo-worker/src
rg -n "from './http'|from '../http'" tokyo-worker/src
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Green means no `request-ops` imports remain and Tokyo-worker typecheck passes.

### Step 4 - Delete Account Localization Barrel

Implement:

- Replace imports from `domains/account-localization` with direct imports.
- Delete `tokyo-worker/src/domains/account-localization.ts`.

Verify:

```bash
rg -n "account-localization['\"]" tokyo-worker/src
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Green means the barrel is gone and direct imports compile.

### Step 5 - Split Tokyo Render Monolith

Implement:

- Create `tokyo-worker/src/domains/render/`.
- Move types first.
- Move pure key/path helpers second.
- Move normalization/read/write helpers third.
- Move pack writing and live-surface orchestration last.
- Leave a small `index.ts` with explicit exports.
- Delete old `tokyo-worker/src/domains/render.ts`.

Verification must happen after each submove:

```bash
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Final green checks:

```bash
test ! -f tokyo-worker/src/domains/render.ts
test -d tokyo-worker/src/domains/render
rg -n "domains/render\\.ts|from './render\\.ts'|from '../domains/render\\.ts'" tokyo-worker/src
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
corepack pnpm --filter @clickeen/tokyo-worker exec wrangler deploy --dry-run --outdir /tmp/clickeen-tokyo-render-split-dryrun
```

Green means the monolith is deleted, the directory boundary compiles, and the worker bundles.

Required render/l10n smoke after the split:

```bash
curl -sS -i "https://tokyo.dev.clickeen.com/renders/instances/<knownPublicId>/live/r.json" | head
curl -sS -i "https://tokyo.dev.clickeen.com/l10n/instances/<knownPublicId>/live/<knownLocale>.json" | head
```

If cloud-dev is not available during local execution, run the equivalent local Tokyo-worker route checks against one known saved instance and record the reason cloud-dev smoke was deferred.

Green means:

- saved instance read still resolves
- live render pointer still resolves
- l10n live pointer still resolves for a known ready locale
- queue job validation still accepts the current mirror job shape
- no render/public projection key changed compared with the post-81A contract

### Step 6 - Full Verification

Run:

```bash
./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
corepack pnpm --filter @clickeen/berlin exec wrangler deploy --dry-run --outdir /tmp/clickeen-berlin-hygiene-dryrun
corepack pnpm --filter @clickeen/tokyo-worker exec wrangler deploy --dry-run --outdir /tmp/clickeen-tokyo-hygiene-dryrun
git diff --check
```

Optional live verification after push:

```bash
curl -sS -i https://berlin-dev.clickeen.workers.dev/healthz | head
curl -sS -i https://tokyo.dev.clickeen.com/healthz | head
```

## 7. Deletion Targets

Must delete if execution is green:

- `berlin/src/supabase-list.ts`
- `tokyo-worker/src/request-ops.ts`
- `tokyo-worker/src/domains/account-localization.ts`
- `tokyo-worker/src/domains/render.ts`

May delete only if proven redundant during execution:

- `tokyo-worker/src/domains/account-localization-utils.ts`

Must not delete in this PRD:

- `berlin/src/account-state.types.ts`
- `berlin/src/profile-normalization.ts`
- `berlin/src/auth-request.ts`

Defer:

- `berlin/src/account-lifecycle.ts`

## 8. Blast Radius

Berlin:

- Auth/session routes may import moved helpers.
- Account bootstrap and account governance may import moved Supabase helpers.
- No endpoint behavior may change.
- No cookie names, auth headers, JWT behavior, or response shapes may change.

Tokyo-worker:

- Every route response passes through HTTP/request finalization.
- Render/l10n/live-surface modules touch account saved config, public render pointers, l10n packs, live public serving, and queue jobs.
- Any storage key drift can break existing instances. Key builders must be moved, not rewritten.
- Storage keys must match PRD 81A after it is executed; this PRD must not preserve or resurrect the pre-81A `/assets/v` or `assets/versions` model.
- Any queue type drift can stop background render/l10n sync.

## 9. Success Criteria

- Fake boundary files are deleted.
- `render.ts` is deleted and replaced by focused render modules.
- Typecheck passes for Berlin and Tokyo-worker.
- Worker dry-runs pass for Berlin and Tokyo-worker.
- Greps prove old imports/files are gone.
- No product behavior changes are introduced.
- Docs remain aligned with the surviving ownership model.

## 10. Explicit Non-Goals

- Do not optimize PostgREST query shapes in this PRD.
- Do not refactor account-state runtime.
- Do not move profile normalization.
- Do not alter Tokyo storage taxonomy.
- Do not change account-widget l10n generation.
- Do not change Cloudflare deploy mode.
- Do not create a generic shared utilities package.
