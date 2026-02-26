# PRD 51 - Asset Contract Hard-Cut (Immutable, No Replace)

## Simple asset tenets (hard, cross-PRD)

1. Asset flow is straightforward. User uploads Asset A in Bob -> Asset A is immediately linked in the instance and stored in Tokyo. User uploads Asset B in Bob -> Asset B is immediately linked in the instance and stored in Tokyo. Bob does not manage assets.
2. Embed does not manage assets. Embed serves exactly what the published embed config references. No fallback, no fixes, no intervention. If an asset was deleted, embed does not show it.
3. Users manage assets only in Roma Assets panel. That is the single place to view assets and fix asset issues. System does not add hidden replacement logic, silent fixes, or fallback behavior.
4. Asset entitlements are enforced in the Roma Assets panel. If user cannot upload due to entitlement, UX routes the user to Assets panel to manage assets.
5. R2 is a simple mirror of Roma Assets panel for account asset namespace. What Roma Assets shows is exactly what exists in R2 under `assets/versions/{accountId}/`. No hidden artifacts, no ghost files, no deferred cleanup, no system-managed invisible storage.

---

Status: EXECUTED (local + cloud-dev parity green)  
Date: 2026-02-26  
Owner: Product Dev Team  
Priority: P0

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

End asset instability by enforcing one immutable contract: config stores `asset.versionId` refs, runtime serves `/assets/v/{encodeURIComponent(versionId)}`, and operations are only upload, select, and delete.

---

## Approach concept - R2 mirrors Roma Assets

Operational rule:
1. Roma Assets panel is the user-visible truth for account assets.
2. R2 account asset namespace is exact storage truth for the same set.
3. These two views must remain equal for each account.

What this means:
1. Upload in Bob or Roma Assets creates visible Roma Assets row and corresponding R2 key under `assets/versions/{accountId}/...`.
2. Delete in Roma Assets removes metadata and R2 blob in the same request path (no deferred orphan cleanup behavior).
3. Entitlement limits apply to the visible/manageable asset set in Roma Assets, which mirrors stored account asset blobs.
4. Non-user artifacts (for example render snapshots or l10n overlays) must live outside account asset namespace (for example `/renders/`, `/l10n/`) and never appear as hidden account assets.

Audit invariant:
1. For each account, orphan account-asset blobs in `assets/versions/{accountId}/` not referenced by `account_asset_variants` must be zero.

---

## Execution To-Do (anti-drift, do in order)

Hard stop rules:
1. Do not add fallback code.
2. Do not keep legacy replace paths "temporarily".
3. Do not start PRD 50 closure work until PRD 51 slices A/B/E are complete.
4. Do not ship if any legacy replace symbol still exists in runtime code.

Legacy kill list (must be empty in runtime code before merge):
1. [x] `accountAssetContentMatch`
2. [x] `handleAccountAssetReplaceContent`
3. [x] `replaceAccountAssetVariantAtomic`
4. [x] `replace_account_asset_variant`
5. [x] `account_asset_replace_idempotency`
6. [x] `/api/assets/:accountId/:assetId/content` route
7. [x] `coreui.errors.assets.replaceFailed`
8. [x] `replaceEditorAsset`
9. [x] `upsertEditorAsset`

Blocker checks (all must pass):
1. [x] `rg -n "accountAssetContentMatch|handleAccountAssetReplaceContent|replaceAccountAssetVariantAtomic|replaceEditorAsset|upsertEditorAsset|coreui.errors.assets.replaceFailed|buildAccountAssetReplaceKey" bob roma paris tokyo-worker dieter`
2. [x] `rg -n "/api/assets/.*/content|/api/accounts/.*/assets/.*/content" bob roma paris`
3. [x] `rg -n "map\\(\\(seg\\) => encodeURIComponent\\(seg\\)\\)\\.join\\('/'\\)" bob/app/assets/v venice/app/assets/v`
4. [x] Runtime and parity gates in this PRD are green in both local and cloud-dev.

Checklist:
1. [x] Freeze scope to asset contract only. No feature work in same PR.
2. [x] Delete Bob replace route: `bob/app/api/assets/[accountId]/[assetId]/content/route.ts`.
3. [x] Delete Roma replace proxy route: `roma/app/api/assets/[accountId]/[assetId]/content/route.ts`.
4. [x] Remove Paris replace dispatch (`accountAssetContentMatch`) from `paris/src/index.ts`.
5. [x] Remove Paris handler `handleAccountAssetReplaceContent` from `paris/src/domains/accounts/index.ts`.
6. [x] Remove Tokyo worker replace handling:
   - `PUT /assets/:accountId/:assetId` branch in `tokyo-worker/src/index.ts`
   - `handleReplaceAccountAssetContent` in `tokyo-worker/src/domains/assets-handlers.ts`
   - `replaceAccountAssetVariantAtomic` in `tokyo-worker/src/domains/assets.ts`
7. [x] Add forward migration to drop replace DB contract:
   - function `replace_account_asset_variant(...)`
   - table `account_asset_replace_idempotency`
8. [x] Remove replace-oriented helper code from editor upload utility:
   - `dieter/components/shared/assetUpload.ts` (`replaceEditorAsset`, `upsertEditorAsset`, replace endpoint builder)
9. [x] Update dropdown upload wording from "Replace" to immutable wording ("Upload new file") in `dieter/components/dropdown-upload/dropdown-upload.ts`.
10. [x] Fix Bob proxy `/assets/v/*` to forward encoded suffix as opaque token in `bob/app/assets/v/[...path]/route.ts`.
11. [x] Fix Venice proxy `/assets/v/*` with same opaque token forwarding in `venice/app/assets/v/[...path]/route.ts`.
12. [x] Update runtime parity asset scenario from upload+replace+delete to upload+delete in `scripts/ci/runtime-parity/scenarios/asset-lifecycle-parity.mjs`.
13. [x] Update contract guard script removing replace expectations in `scripts/verify-contracts.mjs`.
14. [x] Update bootstrap boundary allowlist removing deleted Bob route in `scripts/ci/check-bob-bootstrap-boundary.mjs`.
15. [x] Run local gates:
   - `bash scripts/dev-up.sh`
   - `pnpm test:paris-boundary`
   - `pnpm test:bob-bootstrap-boundary`
   - `pnpm test:runtime-parity:public`
   - `pnpm test:runtime-parity:auth`
   - `pnpm lint`
   - `pnpm typecheck`
16. [x] Run cloud-dev parity gates:
   - `pnpm test:runtime-parity:cloud-dev:public`
   - `pnpm test:runtime-parity:cloud-dev:auth`
   - `pnpm test:runtime-parity:cross-env`
17. [x] Record proof in `051__Execution_Report.md` (image + video, upload once/apply once, no duplicate upload needed).

Completion gate:
1. [x] If any replace endpoint/function/table/reference still exists, PRD 51 is not complete.

---

## Fixed tenets (do not reinterpret)

1. DevStudio is internal tooling with Bob, using the same admin account, for curated instance management only.
2. Roma is the product shell for workspace users (currently admin account in local).
3. DevStudio and Roma are two hosts over the same runtime contract. No host-specific hacks.
4. There is no "replace asset" concept. Assets are immutable.
5. To change a media file, user uploads a new asset and links it. Old asset remains immutable until deleted.

---

## Why this PRD exists

We are stuck because we kept fixing symptoms.

Observed failure loop:
1. Upload succeeds and appears in Roma Assets.
2. DevStudio/Bob preview fails to load canonical asset URL (`404` through host proxy).
3. User uploads again to force apply.
4. Asset table shows duplicates that are user retries, not product intent.

This PRD removes the causes, not just one bug.

---

## End state

1. Persisted config contains immutable asset refs only (`asset.versionId` and `poster.versionId` where applicable).
2. Persisted config does not contain runtime asset URLs (`/assets/v/*`) or legacy `/arsenale/*` paths.
3. Bob and Venice proxy `/assets/v/*` tokens as opaque encoded payloads (no segment re-encoding drift).
4. Asset API surface is upload/list/get/delete only.
5. `PUT .../assets/:assetId/content` is removed from Bob, Roma, Paris, and Tokyo worker.
6. Upload once and apply once works in DevStudio and Roma for image and video fields.

---

## Current delta vs target

| Area | Current state (repo/runtime) | Target state |
| --- | --- | --- |
| API surface | Replace endpoint exists (`/api/assets/:accountId/:assetId/content`, `/api/accounts/:accountId/assets/:assetId/content`, `/assets/:accountId/:assetId` PUT) | Replace endpoint removed everywhere |
| Data model semantics | Immutable refs are enforced in validation, but replace-in-place stack still exists | Full immutable model with no replace-in-place code path |
| Host proxy behavior | Bob and Venice `/assets/v/[...path]` re-encode segments | Opaque suffix forwarding; canonical single-encoded token parity with Tokyo |
| Runtime checks | Asset parity scenario still asserts upload + replace + delete | Asset parity scenario asserts upload + delete + canonical read parity |
| Contract checks | `scripts/verify-contracts.mjs` still expects replace RPC/route | Contract checks updated to immutable-only asset lifecycle |

---

## Contract after hard-cut

### Persisted config

Allowed:
1. `*.asset.versionId` (string; canonical immutable version key)
2. `*.poster.versionId` (string; canonical immutable version key)

Rejected on write:
1. Persisted `/assets/v/*` URLs inside config fields
2. Legacy `/arsenale/*` paths
3. Persisted media URL fields (`fill.image.src`, `fill.video.src`, `fill.video.posterSrc`, string `fill.video.poster`)

### Runtime materialization

1. Runtime path is derived from version id only: `/assets/v/{encodeURIComponent(versionId)}`.
2. Hosts proxy this path unchanged to Tokyo.
3. No `CK_ASSET_ORIGIN`-style host-specific resolution logic.

### Asset operations

Allowed operations:
1. `POST /api/assets/upload`
2. `GET /api/assets/:accountId`
3. `GET /api/assets/:accountId/:assetId`
4. `DELETE /api/assets/:accountId/:assetId?confirmInUse=1`

Removed operation:
1. `PUT /api/assets/:accountId/:assetId/content`

---

## Execution plan

### Slice A - Remove replace endpoint stack (P0)

Goal: eliminate mutable asset semantics from API/runtime.

Actions:
1. Remove Bob route: `bob/app/api/assets/[accountId]/[assetId]/content/route.ts`.
2. Remove Roma proxy route: `roma/app/api/assets/[accountId]/[assetId]/content/route.ts`.
3. Remove Paris route dispatch and handler:
   - `paris/src/index.ts` (`accountAssetContentMatch` branch)
   - `paris/src/domains/accounts/index.ts` (`handleAccountAssetReplaceContent`)
4. Remove Tokyo worker replace path:
   - `tokyo-worker/src/index.ts` (`PUT /assets/:accountId/:assetId`)
   - `tokyo-worker/src/domains/assets-handlers.ts` (`handleReplaceAccountAssetContent`)
   - `tokyo-worker/src/domains/assets.ts` (`replaceAccountAssetVariantAtomic`)
5. Remove replace DB contract with forward migration:
   - drop function `replace_account_asset_variant(...)`
   - drop table `account_asset_replace_idempotency`
   - file: new migration in `supabase/migrations/`
6. Remove replace-only reason keys/usages (`coreui.errors.assets.replaceFailed`) where no longer valid.

Acceptance:
1. All previous replace endpoints return `405` or `404` and have no callers.
2. Compile/test passes with no references to removed replace handler stack.

### Slice B - Fix canonical `/assets/v/*` proxy behavior (P0)

Goal: same canonical URL result on Tokyo, Bob, and Venice.

Actions:
1. Update Bob proxy route to forward raw encoded suffix, not segment-re-encoded path:
   - `bob/app/assets/v/[...path]/route.ts`
2. Apply same behavior in Venice:
   - `venice/app/assets/v/[...path]/route.ts`
3. Keep traversal safety checks (`.` and `..` rejection).
4. Keep cache/header passthrough behavior.

Acceptance:
1. For same canonical URL, Tokyo/Bob/Venice statuses match.
2. Single-encoded token succeeds where resource exists; double-encoding is not required.

### Slice C - Enforce immutable editor behavior (P0)

Goal: editor upload flow matches immutable contract and terminology.

Actions:
1. Keep editor upload path as upload-only and relink-only.
2. Remove dead replace helpers from shared upload utility:
   - `dieter/components/shared/assetUpload.ts` (`replaceEditorAsset`, `upsertEditorAsset`, replace endpoint builder)
3. Update UI wording that implies in-place mutation ("Replace") to immutable wording ("Upload new file") where needed:
   - `dieter/components/dropdown-upload/dropdown-upload.ts`
4. Keep storing `versionId` in meta and writing transparent visual fallback for logo fills as already designed.

Acceptance:
1. No code path calls `/content` replace endpoint.
2. Uploading a new file updates linked `versionId` and preview applies.

### Slice D - Data contract verification and migration closure (P0)

Goal: persisted data is fully aligned with immutable contract.

Actions:
1. Ensure existing hard-cut migrations are applied in target envs:
   - `20260224103000__hard_cut_legacy_asset_paths_to_version_refs.sql`
   - `20260224113000__strip_legacy_fill_media_src_fields.sql`
   - `20260225103000__promote_logofill_asset_urls_to_version_refs.sql`
2. Add one migration for replace-contract removal (Slice A).
3. Run SQL audits (read-only checks) for both `widget_instances` and `curated_widget_instances`:
   - legacy `/arsenale/` paths count
   - persisted `/assets/v/` path count in config JSON text
   - persisted legacy media src field pattern count
4. Record query output in execution report.

Acceptance:
1. Audit counts are zero for legacy persisted path contracts.
2. No unresolved rows remain in admin-owned instances.

### Slice E - Update runtime/contract gates (P0)

Goal: immutable asset lifecycle is the only passing contract.

Actions:
1. Update runtime parity asset scenario from upload+replace+delete to upload+delete:
   - `scripts/ci/runtime-parity/scenarios/asset-lifecycle-parity.mjs`
2. Update contract assertions:
   - `scripts/verify-contracts.mjs` (remove replace expectations, assert immutable-only flow)
3. Update bootstrap boundary allowlist removing deleted route:
   - `scripts/ci/check-bob-bootstrap-boundary.mjs`
4. Add canonical asset URL parity assertions (Tokyo vs Bob vs Venice) to runtime suite.

Acceptance:
1. Gates fail if replace endpoint is reintroduced.
2. Gates fail if canonical token parity regresses.

---

## Required commands

Local:
```bash
bash scripts/dev-up.sh
pnpm test:paris-boundary
pnpm test:bob-bootstrap-boundary
pnpm test:runtime-parity:public
pnpm test:runtime-parity:auth
pnpm lint
pnpm typecheck
```

Cloud-dev:
```bash
pnpm test:runtime-parity:cloud-dev:public
pnpm test:runtime-parity:cloud-dev:auth
pnpm test:runtime-parity:cross-env
```

Canonical URL parity probes (example):
```bash
KEY='assets/versions/<accountId>/<assetId>/<filename>'
ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$KEY")

curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4000/assets/v/$ENC"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/assets/v/$ENC"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3003/assets/v/$ENC"
```

---

## Manual runtime checklist (blocking)

Local:
1. In DevStudio, upload image/video once in a widget field and confirm immediate preview apply.
2. In Roma Assets, confirm exactly one new row per upload action.
3. In Roma builder for same workspace, apply uploaded asset and confirm preview works.
4. Delete asset with usage confirmation flow and verify expected behavior.

Cloud-dev:
1. Repeat same steps.
2. Confirm no host divergence.

---

## Evidence to record (`051__Execution_Report.md`)

Record one row per host/env with fields:
1. `host`
2. `publicId`
3. `assetId`
4. `versionId`
5. `tokyoAssetStatus`
6. `bobAssetStatus`
7. `veniceAssetStatus`
8. `uploadAppliedInPreview` (`true|false`)
9. `duplicateUploadNeeded` (`true|false`)
10. `deleteStatus`
11. `parityResult` (`PASS|FAIL`)

---

## Rollback

1. Roll out by slice.
2. If a slice regresses, roll back that slice only.
3. Do not reintroduce replace endpoint as fallback.

---

## Definition of done

All must be true:
1. Replace endpoint stack is removed end-to-end.
2. Bob and Venice canonical `/assets/v/*` behavior matches Tokyo.
3. Editor flow is immutable (`upload/select/delete` only).
4. Legacy persisted asset path audits are zero.
5. Runtime parity and contract checks pass in local and cloud-dev.
6. `051__Execution_Report.md` contains concrete evidence for image and video flows.
