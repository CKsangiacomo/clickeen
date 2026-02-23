# PRD 049B - Global Asset Lifecycle and Reuse (Part of PRD 49)

**Status:** EXECUTING (Local complete; cloud-dev runtime verification pending)  
**Date:** 2026-02-19  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Parent PRD:** `Execution_Pipeline_Docs/02-Executing/049__PRD__Infra_and_Architecture_Recovery_Program.md`  
**Sequence:** B (after 049A)  
**Program membership:** This PRD is part of PRD 49 and cannot be executed standalone.

---

## Non-negotiable Tenets (inherited from PRD 49, must hold)

1. Bob in Roma and Bob in DevStudio is the same system.
2. Bob loads entitlements at auth; after that Bob does not re-check entitlements for actions (server still enforces writes).
3. Uploading an asset is simple; uploaded assets flow directly into Tokyo.
4. Deleting an asset is immediate hard delete (with confirm when in use); no soft delete.
5. Asset management is account-tied and straightforward.
6. Assets carry the file name in the system and nothing else.
7. There is no asset fallback.
8. Asset replacement updates embeds immediately and automatically.
9. Assets are global and reusable across unlimited instances in the same account.
10. Admin in Roma and DevStudio is just another account profile (same model, unlimited caps, no ad-hoc runtime path).
11. Everything that works in local works the same way in cloud-dev/Cloudflare.
12. No API file can exceed 800 LOC.
13. There is no legacy support and no back-compat execution path.

---

## 1) Architecture tenet lens for PRD B

1. `Tenet 0 (editing platform, no fallback)`: missing asset must be visible missing; never auto-substitute.
2. `Tenet 2 (dumb orchestrators)`: orchestrators move canonical pointer data, no hidden mutation/repair behavior.
3. `Tenet 3 (fail visibly)`: delete/replace/missing states must be explicit.
4. `Tenet 4 (Dieter tokens)` applies to UI rendering only; asset behavior changes must not bypass Dieter component contracts.
5. `Tenet 13 (no legacy/backcompat)`: remove old soft-delete/replace compatibility behavior; do not dual-run legacy and new flows.

---

## 2) Purpose

Recover the asset system to a pointer-truth model:
1. Upload is simple and account-scoped.
2. Delete is immediate hard delete.
3. Replace is in-place with stable pointer.
4. Missing remains missing (no fallback).
5. Assets are globally reusable across unlimited instances in same account.

This PRD executes Tenets: 3, 4, 5, 6, 7, 8, 9.

---

## 3) Why this is second

1. Asset behavior is the main product trust break (stale pointers, soft delete, pseudo replacement).
2. It depends on 049A stable host/open contract.
3. It must land before parity and decomposition so later validation is run on correct behavior.

---

## 4) Code-verified as-is issues

| Issue | Evidence | Impact |
| --- | --- | --- |
| Upload creates new `assetId` every time | `tokyo-worker/src/index.ts:2239` | Replace is not replace; old embeds keep old pointer. |
| Pointer response cached for 30s | `tokyo-worker/src/index.ts:2305` | Replacement can appear stale for 30s. |
| Venice also caches pointer for 30s | `venice/lib/tokyo.ts:41` | Embed runtime can stay stale even if Tokyo is fixed. |
| Delete is soft-state + deferred purge endpoint | `tokyo-worker/src/index.ts:1806`, `tokyo-worker/src/index.ts:1932`, `tokyo-worker/src/index.ts:2869` | Violates immediate hard-delete tenet. |
| Upload callers hard-require workspace | `dieter/components/shared/assetUpload.ts:41`, `bob/app/api/assets/upload/route.ts:73`, `tokyo-worker/src/index.ts:2113` | Blocks account-scoped global asset workflow. |
| Replace buttons are upload-only flows | `dieter/components/dropdown-upload/dropdown-upload.ts:207`, `dieter/components/dropdown-fill/dropdown-fill.ts:842` | User thinks "replace" but gets new pointer/asset id. |
| Metadata writes extra fields (`mime`, `source`) | `dieter/components/dropdown-upload/dropdown-upload.ts:238` | Violates filename-only metadata rule. |
| Fill model persists fallback fields | `dieter/components/dropdown-fill/dropdown-fill.ts:981`, `tokyo/widgets/shared/fill.js:208` | Violates no-fallback tenet and can mask missing assets. |
| Asset read models still carry `deletedAt` | `paris/src/domains/accounts/index.ts:199`, `paris/src/domains/roma/index.ts:420`, `roma/components/assets-domain.tsx:13` | Soft-delete semantics leak into runtime/UI contracts. |

---

## 5) Target contracts

### C3-B: Upload is direct and account-scoped

Request headers:
1. `x-account-id` required
2. `x-workspace-id` optional provenance
3. `x-public-id` optional provenance
4. `x-widget-type` optional provenance
5. `x-filename` required
6. `x-variant` optional (default `original`)
7. `x-source` optional trace header
8. Authorization and privilege decisions derive only from authenticated principal/capsule, never from `x-source`.
9. `x-source` is transport/auth-routing context only and is never persisted into asset metadata.

Success payload:

```json
{
  "accountId": "uuid",
  "assetId": "uuid",
  "filename": "string",
  "url": "/arsenale/a/{accountId}/{assetId}"
}
```

### C4-B: Delete is hard delete

1. `DELETE` synchronously removes usage rows, variant rows, and asset row in one request lifecycle.
2. If `usageCount > 0` and request is not confirmed, return `409` with explicit precondition payload (no deletion occurs).
3. After confirmed delete success, pointer becomes unreadable immediately (`404`).
4. R2 object cleanup runs asynchronously after DB deletion commit (`ctx.waitUntil` or equivalent worker async cleanup path).
5. No `deleted_at` runtime model.
6. Delete success payload contains only canonical fields (`accountId`, `assetId`, `deleted`); no deletion timestamp fields.
7. Async R2 cleanup failure cannot restore pointer availability or reintroduce runtime asset state.

### C4b-B: Hard delete failure semantics

1. DB delete is the contract boundary for runtime behavior (pointer truth).
2. If DB delete succeeds and some R2 object deletes fail/time out, request still returns success and marks cleanup pending.
3. Cleanup retries are operational only; they do not create user-visible soft-delete state.

### C4c-B: In-use confirm precondition contract

1. First delete request for an in-use asset returns:
   1. `409 Conflict`
   2. `error.reasonKey = coreui.errors.asset.inUseConfirmRequired`
   3. payload fields: `usageCount`, `requiresConfirm: true`
2. Confirmed delete request is explicit via `?confirmInUse=1` query flag.
3. UI flow is mandatory: receive `409` precondition -> show confirm -> retry with `confirmInUse=1`.

### C5-B: Replace is in-place pointer update

1. `PUT /api/accounts/:accountId/assets/:assetId/content`.
2. Stable `assetId` and stable pointer path.
3. Update `original` variant mapping atomically.
4. Delete previous R2 object only after new mapping is committed.

### C5b-B: Replace concurrency and idempotency

1. Replace requests require `Idempotency-Key` header (UUID).
2. Retries with the same `Idempotency-Key` return the same committed result without reminting mapping changes.
3. Concurrent replace requests for the same `(accountId, assetId)` are serialized with row-level lock on variant mapping state.
4. Commit order defines winner (`last successful commit` is current pointer target).
5. Pointer must never expose partial mapping state during concurrent replace attempts.

### C6-B: No fallback

1. Pointer/object `404` stays explicit.
2. UI explicit missing state only; never substitute another asset.
3. Required UI copy:
   - `Asset unavailable`
   - `Asset URL is unavailable. Replace file to restore preview.`
4. Persisted fill payload must not include runtime fallback fields for image/video assets.

### C7-B: Filename-only metadata

1. Widget config asset metadata stores only `{ name }`.
2. Runtime behavior must not depend on hidden meta fields.

### C9-B: Global reuse

1. Asset identity is account-scoped and stable.
2. Reuse across instances is pointer reference reuse.
3. Reuse must not clone asset rows by default.

### C13-B: No legacy/backcompat asset behavior

1. Remove legacy soft-delete contracts (`deletedAt`, `alreadyDeleted`, purge-deleted paths).
2. Replace action cannot silently downgrade to upload-new behavior.
3. Do not keep compatibility parsing/writing for legacy fill fallback fields or legacy asset metadata shape.
4. Execute one-time config normalization for stored legacy asset metadata/path fields before strict contracts are enforced.

---

## 6) Cross-product dependency trace (anti-drift)

| Surface | Code evidence | Required change under PRD 49 tenets | Drift if skipped |
| --- | --- | --- | --- |
| Editor upload context source | `bob/components/ToolDrawer.tsx:42` | Keep account id required, make workspace id optional context for Dieter upload controls. | UI still blocks account-global uploads. |
| Dieter shared upload contract | `dieter/components/shared/assetUpload.ts:3` | Change `workspaceId` from required to optional in type, resolver, validator, and headers. | Tenet 9 exists in API but is unreachable from UI. |
| Bob upload edge route | `bob/app/api/assets/upload/route.ts:73` | Remove hard validation on `x-workspace-id`; pass only when present and valid. | Upload fails unless workspace is present. |
| Tokyo upload auth/validation | `tokyo-worker/src/index.ts:2113` | Accept missing workspace for account-scoped uploads; still enforce account ownership and membership rules when workspace is provided. | Global account assets remain pseudo-global only. |
| Replace endpoint routing (Paris) | `paris/src/index.ts:401` | Add route dispatch for `PUT /api/accounts/:accountId/assets/:assetId/content`. | No canonical API entry for real replace-in-place. |
| Replace endpoint implementation (Paris -> Tokyo) | `paris/src/domains/accounts/index.ts:633` | Add handler for replace content and forward with auth to Tokyo. Reuse existing account asset auth/validation path; do not duplicate policy/account checks. | UI replace continues to mint new assets. |
| Replace endpoint implementation (Tokyo) | `tokyo-worker/src/index.ts:2879` | Add `PUT /assets/:accountId/:assetId` handler with atomic variant swap and old object cleanup. | Pointer stability contract cannot be implemented. |
| Replace idempotency propagation | `dieter/components/dropdown-upload/dropdown-upload.ts:207`, `dieter/components/dropdown-fill/dropdown-fill.ts:842` | Send `Idempotency-Key` on replace requests and preserve key across safe retries from UI/client layers. | Duplicate retries can produce accidental double-replace behavior. |
| Dropdown-upload replace behavior | `dieter/components/dropdown-upload/dropdown-upload.ts:207` | On replace, parse current pointer and call replace API. If pointer is missing/invalid, return explicit replace error; do not auto-fallback to upload-new. | Replace button remains misleading upload-new behavior. |
| Dropdown-fill replace behavior | `dieter/components/dropdown-fill/dropdown-fill.ts:842` | Same replace-in-place behavior for image/video fill sources. | Fill assets keep pointer churn and stale embeds. |
| Filename-only metadata | `dieter/components/dropdown-upload/dropdown-upload.ts:238` | Persist only `{ name }` in meta field, drop `mime` and `source`. | Hidden metadata drift breaks Tenet 6. |
| No-fallback fill payload in editor | `dieter/components/dropdown-fill/dropdown-fill.ts:981` | Stop writing `fallback` fields into image/video fill payload. | Runtime keeps showing substitute backgrounds. |
| No-fallback fill runtime in Tokyo widgets | `tokyo/widgets/shared/fill.js:208` | Remove fallback-layer substitution from image/video rendering path. Missing asset must remain missing. | Runtime contradicts editor intent and Tenet 7. |
| Hard delete in Tokyo | `tokyo-worker/src/index.ts:1806`, `tokyo-worker/src/index.ts:1932` | Replace soft-delete + purge with hard delete boundary at DB row deletion and async R2 cleanup. Remove `/assets/purge-deleted`. | Deleted pointers can still serve stale content or resurrect via GC timing. |
| Account asset read model in Paris | `paris/src/domains/accounts/index.ts:199` | Remove `deletedAt` from normalized payload and query logic; use hard-delete semantics only. | UI/API continue modeling soft-delete state. |
| Roma bootstrap asset snapshot | `paris/src/domains/roma/index.ts:398`, `paris/src/domains/roma/index.ts:420` | Remove `deleted_at` projections and `deletedAt` payload fields from domains/assets and usage counters. | Roma surfaces consume stale soft-delete fields. |
| Roma assets domain delete-confirm flow | `roma/components/assets-domain.tsx:13` | Remove `deletedAt`/`alreadyDeleted` assumptions and implement server precondition flow (`409 inUseConfirmRequired` -> confirm modal -> retry with `confirmInUse=1`). | Frontend contract diverges from hard-delete API and can bypass required precondition semantics. |
| Roma bootstrap client typing | `roma/components/use-roma-me.ts:91` | Remove `deletedAt` from `domains.assets.assets[]` shape. | Type drift causes runtime mismatch and hidden bugs. |
| Venice pointer cache behavior | `venice/lib/tokyo.ts:41` | Pointer fetch must not be force-cached for 30s; follow immediate pointer truth requirement. | Embed runtime can serve old bytes after replace. |
| Cloudflare pointer cache guardrails | `tokyo-worker/src/index.ts:2305`, `venice/lib/tokyo.ts:41` | Enforce pointer no-cache headers (`Cache-Control`, `CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control` all `no-store`) and ensure no edge cache rule overrides `/arsenale/a/*`. | Intermediary cache can silently reintroduce stale pointer behavior. |
| DevStudio asset upload helper | `admin/src/html/tools/dev-widget-workspace.html:1810` | Standard account/workspace uploads must align with optional workspace provenance and canonical pointer URL contract. | DevStudio becomes a separate asset protocol again. |
| Asset usage validator and sync RPC | `paris/src/shared/assetUsage.ts:126` | Remove deleted-at assumptions after schema drop and keep strict pointer/account checks. | Publish may reject valid assets or miss invalid references. |
| DB schema | `supabase/migrations/*` | Drop `account_assets.deleted_at`, enforce hard-delete semantics, keep ownership and usage tables aligned with replace-in-place. | Runtime/app code cannot enforce Tenets 4/8/9 consistently. |
| Tenet 12 prerequisite for touched API module | `tokyo-worker/src/index.ts:1` | Split asset handlers into `<=800 LOC` modules before functional behavior edits for PRD B paths. | PRD B lands while a non-negotiable tenet remains violated in touched API code. |

Execution rule for this table:
1. Every row is blocking.
2. No waivers or compatibility exceptions.
3. Replacing assets is not complete until dropdown-upload, dropdown-fill, Tokyo, Paris, and Venice rows are all green.

---

## 7) Data/storage changes

### M49B-01 Remove soft-delete model

1. Hard-delete existing soft-deleted rows before dropping column.
2. Drop `account_assets.deleted_at`.
3. Remove `includeDeleted`, `queuedGc`, `previouslyDeleted`, and purge-deleted operational contract from runtime paths.

### M49B-02 Preserve account-owned global identity

1. Keep `account_id + asset_id` ownership model.
2. Keep workspace/public/widget provenance optional only.
3. Keep `account_asset_usage` as reference mapping, not ownership mapping.

### M49B-03 Pointer truth caching

1. Pointer responses set all no-cache headers: `Cache-Control: no-store`, `CDN-Cache-Control: no-store`, `Cloudflare-CDN-Cache-Control: no-store`.
2. Immutable object paths remain immutable-cache friendly.
3. Venice pointer fetch uses `cache: 'no-store'`.
4. Cloudflare edge/cache rules must not override `/arsenale/a/*` with cache-everything behavior.

### M49B-04 Async R2 cleanup invariants

1. After hard delete commit, pointer remains `404` regardless of R2 cleanup status.
2. R2 cleanup retries are operational tasks, not runtime asset states.
3. No API/read model exposes soft-delete-like intermediate status.

### M49B-05 Legacy config normalization cutover

1. Run one-time normalization over stored widget configs that removes legacy asset metadata fields (`mime`, `source`) and legacy fallback asset fields.
2. Normalize legacy asset URL forms to canonical pointer form where resolvable.
3. If a legacy asset reference cannot be normalized to a valid pointer, preserve explicit missing-state semantics (no fallback substitution).
4. Complete normalization before strict no-legacy readers/writers are enforced in runtime paths.

---

## 8) Implementation scope

### Files/services touched

1. `tokyo-worker/src/index.ts`
2. `paris/src/index.ts`
3. `paris/src/domains/accounts/index.ts`
4. `paris/src/domains/roma/index.ts`
5. `paris/src/shared/assetUsage.ts`
6. `bob/app/api/assets/upload/route.ts`
7. `bob/components/ToolDrawer.tsx`
8. `dieter/components/shared/assetUpload.ts`
9. `dieter/components/dropdown-upload/dropdown-upload.ts`
10. `dieter/components/dropdown-fill/dropdown-fill.ts`
11. `tokyo/widgets/shared/fill.js`
12. `roma/components/assets-domain.tsx`
13. `roma/components/use-roma-me.ts`
14. `venice/lib/tokyo.ts`
15. `admin/src/html/tools/dev-widget-workspace.html`
16. `supabase/migrations/*` (new migration)

### Required changes

1. Implement hard delete path end-to-end.
2. Implement replace-in-place API path end-to-end.
3. Make workspace provenance optional for upload callers.
4. Enforce no-fallback behavior in editor and runtime.
5. Enforce filename-only metadata.
6. Keep cross-instance reuse pointer-stable.
7. Remove legacy soft-delete/compatibility contracts from API payloads and UI types.
8. Replace action must fail explicitly when replace preconditions are not met; no implicit upload downgrade.
9. Implement async R2 cleanup after hard delete DB commit and remove request-coupled purge semantics.
10. Reuse existing account asset auth/validation for replace endpoint; no duplicate enforcement branch.
11. Enforce delete confirm precondition contract (`409` -> confirm -> retry with `confirmInUse=1`).
12. Enforce replace idempotency/concurrency semantics (`Idempotency-Key`, serialized mapping swap).
13. Enforce Cloudflare pointer no-store headers and no override cache rules on `/arsenale/a/*`.
14. Execute one-time legacy config normalization before strict no-legacy runtime paths.
15. Split touched API module(s) over 800 LOC before functional behavior changes (Tenet 12 prerequisite).

---

## 9) Verification

### API tests

1. T-01 upload canonical pointer URL.
2. T-01b account-scoped upload without workspace provenance.
3. T-02 delete -> immediate pointer `404`.
4. T-02b delete in-use without confirm returns `409` with `requiresConfirm=true` and `usageCount`; retry with `confirmInUse=1` succeeds.
5. T-03 replace same pointer -> changed bytes.
6. T-03b replace preserves `assetId` and pointer URL.
7. T-03c replace with invalid/missing pointer precondition fails explicitly (no upload fallback).
8. T-03d replace retries with same `Idempotency-Key` return same committed result.
9. T-03e concurrent replaces on same asset serialize; pointer resolves to last successful commit.
10. T-04 hard delete with injected R2 partial failure still returns success after DB commit and pointer remains `404`.

### Runtime/UI tests

1. T-05 missing asset explicit UI state and no fallback substitution.
2. T-06 filename-only metadata persisted.
3. T-07 global reuse across instances with same `assetId`.
4. T-08 dropdown-fill replace keeps pointer stable.
5. T-09 Venice embed serves updated bytes immediately after replace.
6. T-10 no legacy asset fields (`deletedAt`, `alreadyDeleted`) are consumed or emitted by Roma/Bob UI contracts.
7. T-11 one-time normalization removes legacy asset metadata/fallback fields from stored configs without introducing fallback rendering.

### Environment checks

1. Run local first.
2. Re-run same matrix in cloud-dev.
3. Verify pointer responses in cloud-dev include all no-store headers and are not edge-cached by Cloudflare rules.

---

## 10) Exit gate (blocking)

1. Hard delete complete, no soft-delete runtime semantics.
2. Replace-in-place complete and immediate pointer truth across Bob/Roma/Venice.
3. Upload supports account-scoped mode without workspace hard requirement.
4. No fallback behavior enforced in API, editor, and runtime.
5. Reuse across instances keeps stable `assetId`.
6. All dependency-table rows are complete.
7. No legacy/backcompat asset contract remains in API/UI/runtime paths.
8. Hard delete request correctness is not coupled to tail R2 delete latency; pointer truth remains immediate.
9. Delete confirm precondition and replace idempotency/concurrency contracts are enforced server-side.
10. Touched API modules satisfy Tenet 12 (`<=800 LOC`) before PRD B closes.

---

## 11) Execution sequence (mandatory)

1. Split touched API module(s) over 800 LOC for PRD-B paths (at minimum `tokyo-worker/src/index.ts`) before functional behavior changes.
2. Add replace-in-place endpoint path (Paris + Tokyo) with existing auth/validation reuse and idempotency contract.
3. Flip pointer caching to no-store across Tokyo + Venice + Cloudflare edge rules.
4. `Stop Gate A`: validate pointer no-store behavior in local + cloud-dev before proceeding.
5. Switch Dieter replace actions (`dropdown-upload` + `dropdown-fill`) to replace-in-place endpoint with `Idempotency-Key`.
6. Switch upload callers to account-scoped mode (workspace optional) across Dieter/Bob/Tokyo validation chain.
7. Cut hard delete boundary to DB deletion commit + async R2 cleanup; add delete-confirm precondition contract; remove purge-deleted endpoint path.
8. `Stop Gate B`: validate delete precondition flow (`409` confirm contract) + immediate pointer `404` + R2 partial-failure invariants.
9. Remove `deletedAt` runtime read-model fields from Paris/Roma UI contracts.
10. Remove `deleted_at` usage from `paris/src/shared/assetUsage.ts` select/filter logic.
11. Run one-time legacy config normalization cutover.
12. Drop `account_assets.deleted_at` column migration.

Execution rule:
1. Step 10 must land before or with step 12.
2. Step 11 must complete before strict no-legacy runtime enforcement gates are closed.
3. Steps 1-12 must execute in order; no reordering.

---

## 12) Handover to 049C

049C starts only after 049B gate is green, so parity and resilience are validated on corrected asset behavior.
