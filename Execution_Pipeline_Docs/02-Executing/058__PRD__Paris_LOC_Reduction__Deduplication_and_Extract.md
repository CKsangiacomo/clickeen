# PRD 058 — Paris LOC Reduction: Deduplication and Extract

Status: EXECUTING
Date: 2026-03-06
Owner: Product Dev Team
Priority: P1 (code quality — zero functionality change)

Execution update (local):
- Cut 4 landed: repeated `confirm=1` parsing in `paris/src/domains/accounts/index.ts` now uses shared `hasConfirmedQueryParam()` from `paris/src/shared/http.ts`.
- Cut 6 landed: repeated `error instanceof Error ? error.message : String(error)` sites now funnel through shared `errorDetail()` in `paris/src/shared/errors.ts`.
- Cut 7 landed: `paris/src/domains/accounts/index.ts` no longer redefines `assertAccountId`; it now imports the shared validator from `paris/src/shared/validation.ts`.
- Cut 8 landed: shared `normalizeMemberRole()`, `roleRank()`, and `tierRank()` now live in `paris/src/shared/roles.ts`; local copies were removed from auth/bootstrap/account lifecycle files.
- Cut 1 mostly landed: overlay-row -> locale/user ops map planning, locale text-pack materialization, and the repeated text/meta/config/sync enqueue loops are now shared in `paris/src/shared/mirror-packs.ts`; call sites still own the surrounding publish/l10n condition orchestration.
- Cut 1 tightened further: the remaining Tokyo mirror enqueue error logging is now shared in `paris/src/shared/mirror-packs.ts`, so the surviving create/update/account-l10n handlers only express orchestration, not repeated failure-loop boilerplate.
- `l10n/layers-handlers.ts` no longer carries the same published layer mirror block twice; the file now routes both upsert/delete paths through one local `mirrorPublishedLayerLocale()` helper.
- Cut 2 landed: `bob/components/TdMenuContent.tsx` read-only toggling now uses shared helper functions (`applyDisabledState`, `applyReadOnlyFlag`) instead of duplicated input/textarea/select/button blocks.
- Cut 5 landed as hard-cut simplification: `paris/src/domains/accounts/index.ts` removed local Tokyo base/token helper wrappers; purge path now uses one in-function contract with no duplicated wrapper functions.
- Curated display helper cut landed: duplicated `readCuratedMeta()`/`formatCuratedDisplayName()` logic was removed from three Paris domains and replaced with one shared helper (`paris/src/shared/curated-meta.ts`).
- Mirror overlay-op load cut landed: repeated overlay fetch + try/catch + map-init blocks in create/update/account-l10n handlers now use one shared `resolveLocaleOverlayOps()` helper in `paris/src/shared/mirror-packs.ts`.
- Dead SanFrancisco queue-dispatch cut landed: unused `dispatchSanfranciscoCommand()` path and related queue command types were removed (`paris/src/shared/sanfrancisco.ts`, `paris/src/shared/types.ts`).
- Layer handlers convergence cut landed: repeated auth/policy/publicId/instance/curated-gate setup across list/get/upsert/delete now resolves through one local `resolveLayerRequestContext()` helper in `paris/src/domains/l10n/layers-handlers.ts`.

> Core mandate: Delete duplicated lines. Extract shared helpers. No behavior change. No new features. No new abstractions beyond what the duplication demands.

Context note:
- PRD 057 identified Paris as 12,686 lines / 49 files with significant internal duplication.
- This PRD executes the mechanical deduplication before any architectural migration begins.
- Every cut below is verified by direct file inspection and grep. Zero dead code was found — these are all copy-paste duplicates.

Environment contract:
- Canonical integration truth: cloud-dev.
- Local startup: `bash scripts/dev-up.sh`.
- All changes are internal refactors. No API contract changes. No response shape changes. No route changes.

---

## One-line Objective

Remove ~386 lines of verified copy-paste duplication from Paris (and one Bob file) by extracting shared helpers. Zero functionality change.

---

## Cuts

### Cut 1 — Tokyo Mirror Ceremony Extraction (~200 LOC)

**The single largest cut.** Four files contain near-identical 80-130 line blocks that: load overlays into Maps, build text packs per locale, then enqueue write-text-pack / write-meta-pack / write-config-pack / sync-live-surface jobs.

| File | Lines | Mirror block |
|---|---|---|
| `paris/src/domains/account-instances/update-handler.ts` (521 lines) | 389-517 | 128 lines |
| `paris/src/domains/account-instances/create-handler.ts` (536 lines) | 431-531 | 100 lines |
| `paris/src/domains/l10n/account-handlers.ts` (464 lines) | 365-443 | 78 lines |
| `paris/src/domains/l10n/layers-handlers.ts` (651 lines) | 440-487 + 594-646 | 2 copies, ~100 lines |

Verified identical sub-blocks across all files:
- `localeOpsByLocale` / `userOpsByLocale` Map construction from overlay rows — 20 lines x3
- `localeTextPacks` materialization loop — 12 lines x3
- `write-text-pack` enqueue loop — 13 lines x4
- `write-meta-pack` + `generateMetaPack` — 15 lines x5
- `write-config-pack` + `sync-live-surface` enqueue — 25 lines x3

**Action:** Extract `planAndEnqueueMirrorJobs()` into `paris/src/shared/mirror-packs.ts` (file already exists, already has `stripTextFromConfig`). Each call site becomes ~5 lines.

**Savings:** ~200 lines removed.

### Cut 2 — `applyReadOnlyState` in TdMenuContent.tsx (~55 LOC)

`bob/components/TdMenuContent.tsx` lines 124-206 (82 lines total). Five save/restore blocks for `input`, `textarea`, `select`, `button`, `contenteditable`. The `input` and `textarea` blocks are character-for-character identical (17 lines each). The `select` and `button` blocks are the same pattern minus `readOnly`.

**Action:** One generic helper `toggleFormElements(container, selector, readOnly, attrKeys)`. The `contenteditable` block stays separate (different API — `getAttribute`).

**Savings:** ~55 lines removed.

### Cut 3 — `isSeoGeoLive()` Calls (~16 LOC)

Same 4-line block in 5 locations across 4 files:
- `update-handler.ts:383-387`
- `create-handler.ts:426-429`
- `account-handlers.ts:388-391`
- `layers-handlers.ts:469-472`
- `layers-handlers.ts:628-631`

**Action:** Absorbed into Cut 1 — becomes part of the extracted mirror ceremony function.

**Savings:** ~16 lines (included in Cut 1 total).

### Cut 4 — Confirm-Parameter Parsing (~18 LOC)

`paris/src/domains/accounts/index.ts` has this 6-line block repeated at lines 557, 583, and 634:

```
const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
if (!confirmed) { return ckError({...}, 409); }
```

**Action:** Extract `requireConfirmParam(req, reasonKey)` into `paris/src/shared/http.ts`.

**Savings:** ~18 lines removed.

### Cut 5 — Tokyo Asset Proxy Pattern (~30 LOC)

`paris/src/domains/accounts/index.ts` has 4 nearly identical Tokyo-fetch blocks at lines 396, 511, 782, 831. Each resolves base URL + token, checks for nulls, builds fetch with auth header.

**Action:** Extract `tokyoAssetFetch(env, path, method?)` into `paris/src/shared/tokyo.ts` (or inline in accounts if no other consumer exists).

**Savings:** ~30 lines removed.

### Cut 6 — Error-Detail Extraction Pattern (~35 LOC)

This exact line appears 35 times across 16 Paris files:

```typescript
const detail = error instanceof Error ? error.message : String(error);
```

Always inside a `catch` block followed by `console.warn/error` or `ckError`.

**Action:** Add `errorDetail(error: unknown): string` one-liner to `paris/src/shared/errors.ts`. Replace all 35 sites.

**Savings:** ~35 lines removed (net, including catch-block simplification in the densest files: `widgets-bootstrap.ts` has 7, `accounts/index.ts` has 5).

### Cut 7 — Local `assertAccountId` / `assertAssetId` Re-definitions (~12 LOC)

`paris/src/domains/accounts/index.ts` lines 17-34 defines `assertAccountId` and `assertAssetId` locally (17 lines). `assertAccountId` already exists in `paris/src/shared/validation.ts` and is imported by other files.

**Action:** Import from `shared/validation.ts`. Add `assertAssetId` to `shared/validation.ts` if not already there. Delete local copies.

**Savings:** ~12 lines removed.

### Cut 8 — `roleRank` / `tierRank` / `normalizeMemberRole` Locals (~20 LOC)

- `tierRank()` in `accounts/index.ts:36-49` — 13 lines
- `roleRank()` in `roma/widgets-bootstrap.ts:40-53` — 13 lines
- `normalizeMemberRole()` in `roma/widgets-bootstrap.ts:28-38` — 10 lines

Generic utility functions defined locally.

**Action:** Move to `paris/src/shared/roles.ts`. Import where used.

**Savings:** ~20 lines removed.

---

## Execution Order

1. **Cut 6 first** (error-detail helper) — smallest, touches most files, establishes the pattern for the session.
2. **Cut 7** (assertAccountId import) — trivial, unblocks Cut 4/5 which work in the same file.
3. **Cut 4** (confirm-param) — small extract in accounts/index.ts.
4. **Cut 5** (tokyo asset proxy) — small extract in accounts/index.ts.
5. **Cut 8** (roleRank/tierRank) — small extract to shared.
6. **Cut 2** (applyReadOnlyState) — Bob file, independent of Paris cuts.
7. **Cut 1 last** (mirror ceremony) — largest and most complex extract, touches 4 files.

Each cut is independently shippable. If any cut introduces issues, it can be reverted without affecting the others.

---

## Verification

Per cut:
1. `tsc --noEmit` passes (type-check).
2. Grep confirms zero remaining duplicates for the extracted pattern.
3. Manual smoke: the affected flows (publish, create, overlay upsert/delete, tier-change, asset list) behave identically.

No new tests needed — these are pure extractions with no behavior change. Existing test coverage (if any) continues to pass.

---

## Scope

In scope:
- Extract shared helpers from verified duplicated code.
- Delete the duplicated copies.
- Move local utility definitions to shared modules.

Out of scope:
- Any API contract changes.
- Any route additions or removals.
- Any behavior changes.
- Any new features.
- Refactoring code that is not duplicated.
- Architectural changes (those belong to PRD 057).

---

## Summary

| # | Cut | Files touched | LOC saved | Risk |
|---|---|---|---|---|
| 1 | Tokyo mirror ceremony | 4 Paris + 1 shared | ~200 | LOW |
| 2 | applyReadOnlyState | 1 Bob | ~55 | ZERO |
| 3 | isSeoGeoLive calls | absorbed in Cut 1 | ~16 | ZERO |
| 4 | Confirm-param parsing | 1 Paris | ~18 | ZERO |
| 5 | Tokyo asset proxy | 1 Paris + 1 shared | ~30 | ZERO |
| 6 | Error-detail pattern | 16 Paris | ~35 | ZERO |
| 7 | assertAccountId local | 1 Paris | ~12 | ZERO |
| 8 | roleRank/tierRank locals | 2 Paris + 1 shared | ~20 | ZERO |
| | **TOTAL** | | **~386** | |
