# PRD 49 - Infra and Architecture Recovery Program (Bob <-> Roma <-> DevStudio <-> Paris <-> Tokyo)

**Status:** EXECUTING (Local complete; cloud-dev runtime verification pending)  
**Date:** 2026-02-19  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Type:** Architecture recovery + infra hardening + behavior convergence  
**Priority:** P0  

---

## Program split (canonical execution order)

This PRD is the umbrella program document. Execution is split into smaller sequenced PRDs:

1. `Execution_Pipeline_Docs/02-Executing/049A__PRD__Editor_Contract_and_Admin_Account_Unification.md`
2. `Execution_Pipeline_Docs/02-Executing/049B__PRD__Global_Asset_Lifecycle_and_Reuse.md`
3. `Execution_Pipeline_Docs/02-Executing/049C__PRD__Bootstrap_Resilience_and_Local_Cloudflare_Parity.md`
4. `Execution_Pipeline_Docs/02-Executing/049D__PRD__API_Decomposition_and_Release_Governance.md`

Execution rule:
1. A -> B -> C -> D is mandatory.
2. Do not start the next PRD until the current PRD exit gate is green.

Why this split is required:
1. Reduces blast radius: each PRD has one reviewable responsibility.
2. Makes peer review executable: smaller contracts, smaller diffs, clearer gates.
3. Prevents contract drift: dependencies are explicit and sequenced.
4. Speeds delivery with multi-team parallelism while keeping merge risk controlled.

---

## Non-negotiable Tenets (must hold)

1. **Bob in Roma and Bob in DevStudio is the same system.**  
   One open contract, one lifecycle, one behavior.

2. **Bob loads entitlements at auth; after that Bob does not check entitlements again for actions.**  
   Bob uses the issued policy snapshot. Server still enforces writes.

3. **Uploading an asset is simple; uploaded assets flow directly in Tokyo as they are uploaded.**  
   One upload path, one canonical pointer URL.

4. **Deleting an asset is immediate hard delete (with confirm when in use); no soft delete.**  
   No `deleted_at` lifecycle in runtime behavior.

5. **Asset management is account-tied and straightforward.**  
   Ownership is account-level. Workspace filters are view filters only.

6. **Assets carry the file name in the system and nothing else.**  
   UI metadata stays filename-focused.

7. **There is no asset fallback.**  
   If asset is missing, we show missing. We do not auto-substitute.

8. **Asset replacement updates embeds immediately and automatically.**  
   Same pointer path, new file content, immediate propagation.

9. **Assets are global and must be architected/stored for elegant reuse across as many instances as the user wants.**  
   Asset identity and storage must support direct cross-instance reuse without duplication hacks or ad-hoc constraints.

10. **Admin in Roma and DevStudio is just another account: same entitlement model, unlimited caps, no ad-hoc code paths.**  
    Platform/admin behavior must use the same account architecture and contracts as product accounts, with policy/profile differences only.

11. **Everything that works in local must work the same in Cloudflare.**  
    Local and cloud-dev/prod behavior parity is mandatory; no environment-specific logic that changes product behavior.

12. **No API file can exceed 800 LOC.**  
    API handlers must be split into clear modules before crossing 800 LOC to keep ownership and review quality high.

13. **There is no legacy support and there is no back-compat execution path.**  
    Recovery work must remove legacy/dual-path behavior, not preserve it behind compatibility adapters.

---

## 0) Why this PRD exists

PRDs 45-48 introduced contract drift across editor hosts and asset lifecycle behavior.

Recovery goal: one predictable editor + asset system that is testable, reviewable, and release-safe.

---

## 1) Scope

### In scope
1. Bob open contract convergence (Roma + DevStudio).
2. Entitlement/policy handling cleanup in open/runtime flow.
3. Asset upload/delete/replace contract hardening.
4. Removal of soft-delete behavior from runtime semantics.
5. Bootstrap resilience: partial-domain degradation instead of total failure.
6. Global account-asset reuse model across unlimited instances.
7. Admin-as-account unification (Roma + DevStudio) with no ad-hoc runtime branches.
8. Local-to-Cloudflare behavior parity hardening.
9. API module decomposition so no API file exceeds 800 LOC.

### Out of scope
1. New widget features.
2. Visual redesign.
3. Broad refactors unrelated to the tenets.

---

## 2) As-is facts from code (what is broken today)

| Area | As-is behavior | Evidence | Tenet impact |
| --- | --- | --- | --- |
| Bob open lifecycle duplicated | Roma and DevStudio both implement ack/retry/timeout logic separately. | `roma/components/builder-domain.tsx:191`, `admin/src/html/tools/dev-widget-workspace.html:2790` | Violates Tenet 1 (same system). |
| Subject/path divergence | Roma opens with `subjectMode: 'workspace'`, DevStudio opens with `subjectMode: 'devstudio'`. | `roma/components/builder-domain.tsx:350`, `admin/src/html/tools/dev-widget-workspace.html:2770` | Violates Tenet 1 (behavior split). |
| DevStudio hardcoded workspace | Runtime defaults to fixed UUID in open/fetch path. | `admin/src/html/tools/dev-widget-workspace.html:816`, `admin/src/html/tools/dev-widget-workspace.html:1334` | Violates Tenet 1 and account/workspace clarity. |
| Roma dead-end on missing publicId | Builder can stop at "No instance selected" instead of deterministic fallback route. | `roma/components/builder-domain.tsx:464` | Breaks predictable open flow. |
| Soft delete in Tokyo | Delete marks `deleted_at`; physical purge is deferred endpoint (`/assets/purge-deleted`). | `tokyo-worker/src/index.ts:1806`, `tokyo-worker/src/index.ts:1932`, `tokyo-worker/src/index.ts:2869` | Violates Tenet 4. |
| Pointer cache stale window | Pointer responses use `max-age=30, s-maxage=30`. | `tokyo-worker/src/index.ts:2305` | Violates Tenet 8 (immediate replacement). |
| Replacement is not true replacement | Upload always creates new `assetId`; replace buttons in UI call upload only. | `tokyo-worker/src/index.ts:2239`, `dieter/components/dropdown-upload/dropdown-upload.ts:231` | Violates Tenet 8. |
| Asset metadata bloat in editor meta | Upload UI stores `{name,mime,source}` metadata object. | `dieter/components/dropdown-upload/dropdown-upload.ts:238` | Violates Tenet 6 (filename-only). |
| Bootstrap failure fanout | Domain snapshot build is one `Promise.all`; one failure returns 500 auth context unavailable. | `paris/src/domains/roma/index.ts:1157`, `paris/src/domains/roma/index.ts:2209`, `paris/src/domains/roma/index.ts:2279` | Violates resilience objective. |
| Asset flow is still workspace-coupled at upload time | Upload context currently hard-requires `workspaceId` in editor/proxy path and writes workspace/public provenance fields on asset rows. | `dieter/components/shared/assetUpload.ts:41`, `bob/app/api/assets/upload/route.ts:73`, `tokyo-worker/src/index.ts:1688` | Violates Tenet 9 (global reuse should be first-class). |
| Admin policy path is still special-cased | DevStudio open path uses `subjectMode: 'devstudio'`; policy resolution has explicit `subject=devstudio` branch. | `admin/src/html/tools/dev-widget-workspace.html:2770`, `paris/src/shared/policy.ts:13` | Violates Tenet 10 (admin is account, no ad-hoc path). |
| Local/cloud behavior still has hostname-specific defaults | Local defaults hardcode Bob/Tokyo origins by hostname. | `roma/components/builder-domain.tsx:75`, `admin/src/html/tools/dev-widget-workspace.html:793`, `admin/src/html/tools/dev-widget-workspace.html:805` | Violates Tenet 11 (same behavior across envs). |
| API handlers exceed 800 LOC | Core API files are far above the 800-LOC limit. | `tokyo-worker/src/index.ts` (~3065), `paris/src/domains/roma/index.ts` (~2737), `paris/src/domains/workspaces/index.ts` (~2350) | Violates Tenet 12. |

---

## 3) Target contracts (authoritative spec)

### 3.1 Contract C1 - Host -> Bob open contract is identical

**Applies to:** Roma + DevStudio

**Payload (`ck:open-editor`)**
```json
{
  "type": "ck:open-editor",
  "requestId": "uuid",
  "sessionId": "uuid-or-session-token",
  "subjectMode": "workspace",
  "publicId": "wgt_*",
  "workspaceId": "uuid",
  "ownerAccountId": "uuid",
  "label": "string",
  "widgetname": "string",
  "compiled": {},
  "instanceData": {},
  "localization": {},
  "policy": {},
  "enforcement": {}
}
```

**Lifecycle events**
1. `bob:open-editor-ack` (same `requestId`, `sessionId`)
2. `bob:open-editor-applied` OR `bob:open-editor-failed`

**Timing contract**
1. Retry interval: 250ms
2. Max ack attempts: 6
3. Overall timeout: 7000ms

**Implementation deltas**
1. Extract shared helper from `roma/components/builder-domain.tsx` and use it in DevStudio host flow.
2. Remove duplicate lifecycle implementation from `admin/src/html/tools/dev-widget-workspace.html`.
3. Remove hardcoded `DEV_WORKSPACE_ID` from runtime open path.
4. Standard editor runtime uses one subject mode only: `workspace` (including admin accounts).

### 3.2 Contract C2 - Entitlements loaded once at auth

**Source of truth**
1. Paris workspace instance envelope includes policy snapshot.
2. Bob consumes that snapshot for runtime gating.
3. Server write endpoints remain authoritative.
4. Admin is modeled as an account/profile in the same policy contract (unlimited caps via policy content, not ad-hoc runtime branches).

**Envelope fields required**
1. `policy`
2. `ownerAccountId`
3. `workspace`
4. `enforcement`

**Implementation deltas**
1. Keep envelope contract from `paris/src/domains/workspaces/index.ts:655`.
2. Keep policy resolution centralized in `paris/src/shared/policy.ts`.
3. No Bob runtime call to re-fetch entitlements after open.
4. Remove standard-editor dependence on `subject=devstudio` policy branching.

### 3.3 Contract C3 - Asset upload is one direct path

**Flow**
1. UI/Dieter -> `POST /api/assets/upload` (Bob route)
2. Bob -> Tokyo `POST /assets/upload`
3. Tokyo -> write R2 + metadata rows + return canonical pointer URL

**Request headers**
1. `x-account-id` (required)
2. `x-workspace-id` (optional, provenance only)
3. `x-public-id` (optional)
4. `x-widget-type` (optional)
5. `x-filename` (required)
6. `x-variant` (optional; default `original`)
7. `x-source` (required)

**Success response (stable product fields)**
```json
{
  "accountId": "uuid",
  "assetId": "uuid",
  "filename": "string",
  "url": "/arsenale/a/{accountId}/{assetId}"
}
```

Implementation note:
1. Internal storage/debug fields (`contentType`, `sizeBytes`, `sha256`, `variant`) may exist server-side.
2. Product behavior must rely only on canonical pointer + filename (Tenet 6).

Migration-required caller changes (blocking):
1. Remove hard requirement for `workspaceId` in `dieter/components/shared/assetUpload.ts` (`assertUploadContext`).
2. Remove hard requirement for `x-workspace-id` in `bob/app/api/assets/upload/route.ts`; pass it through only when present/valid.
3. Tokyo upload handler accepts missing `x-workspace-id` for account-scoped uploads and stores provenance as `null`.

### 3.4 Contract C4 - Asset delete is hard delete (no soft state)

**API**
1. Paris: `DELETE /api/accounts/:accountId/assets/:assetId`
2. Tokyo: `DELETE /assets/:accountId/:assetId`

**Required behavior**
1. Confirm in UI if `usageCount > 0` (already in Roma).
2. Same request performs:
   - delete `account_asset_usage`
   - delete `account_asset_variants`
   - delete `account_assets`
   - delete R2 objects for all variant keys
3. Pointer GET returns 404 immediately after delete response.
4. Delete is not soft-delete and does not queue GC.

**Response contract**
```json
{
  "accountId": "uuid",
  "assetId": "uuid",
  "deleted": true,
  "deletedTimestamp": "ISO-8601",
  "purgedObjects": 1,
  "purgedUsage": 2
}
```

**Not allowed anymore**
1. `deleted_at` runtime gating.
2. `queuedGc`, `previouslyDeleted` semantics.
3. `/assets/purge-deleted` operational dependency.

### 3.5 Contract C5 - Replacement keeps same pointer and updates immediately

**New API**
1. Paris: `PUT /api/accounts/:accountId/assets/:assetId/content`
2. Tokyo: `PUT /assets/:accountId/:assetId`

**Request**
1. Binary body (new file)
2. Headers: `content-type`, `x-filename`, optional provenance (`x-workspace-id`, `x-public-id`, `x-widget-type`, `x-source`)

**Behavior**
1. Keep `assetId` unchanged.
2. Keep pointer path unchanged: `/arsenale/a/{accountId}/{assetId}`.
3. Update `original` variant row to new `r2_key`, `filename`, `content_type`, `size_bytes`.
4. Delete old R2 object after variant row update succeeds.
5. Pointer cache headers changed for immediate propagation (see C6).

**Success response**
```json
{
  "accountId": "uuid",
  "assetId": "uuid",
  "filename": "string",
  "url": "/arsenale/a/{accountId}/{assetId}",
  "replaced": true
}
```

### 3.6 Contract C6 - No fallback and immediate pointer truth

**Tokyo serving rules**
1. Pointer GET only serves current mapped object.
2. Missing asset/object returns 404.
3. No alternate asset substitution.

**Cache rule change**
1. Pointer responses: `Cache-Control: no-store`
2. Object responses: keep `no-store` (already current)

**UI behavior**
1. Missing asset is shown as an explicit missing state in editor controls (not silent fallback).
2. Required UI state for upload/fill controls on pointer 404:
   - label/state text: `Asset unavailable`
   - error copy: `Asset URL is unavailable. Replace file to restore preview.`
   - action CTA remains available: `Replace`
3. No hidden fallback image/video.

### 3.7 Contract C7 - Asset management tied to account; filename-only metadata

**Ownership**
1. Account owns assets.
2. Workspace is provenance/filter only.
3. Attaching an existing asset to another instance must reuse the same `assetId` pointer, never clone a new asset record by default.

**Editor metadata rule**
1. Upload meta stored in widget config is filename-only.
2. Replace `{ name, mime, source }` with `{ name }`.

**Not allowed**
1. Runtime behavior based on hidden `source`/`mime` metadata.
2. Per-instance asset duplication as a side effect of attach/reuse.

### 3.8 Contract C8 - Bootstrap degrades by domain (no full outage)

**Endpoint behavior**
1. Auth payload should still return when one domain load fails.
2. `domains` becomes partial payload.
3. `domainErrors` must list failed domain keys and reason.

**Implementation rule**
1. Replace domain `Promise.all` fanout with per-domain `Promise.allSettled` handling.
2. Do not convert non-auth domain load errors into global 500.

### 3.9 Contract C9 - Assets are global and reusable across unlimited instances

**Global asset contract**
1. Account asset IDs are global inside the account namespace.
2. One uploaded asset can be referenced by any number of instances in that account.
3. Reuse operation must be reference-based (pointer reuse), not copy-based.

**Implementation rule**
1. Upload and replace paths may include workspace/public provenance, but provenance must not gate reuse.
2. Usage mapping (`account_asset_usage`) tracks where used; it must not redefine ownership.

### 3.10 Contract C10 - Admin is just another account (unlimited policy, no ad-hoc code)

**Admin contract**
1. Admin in Roma and DevStudio uses the same account/workspace/editor contracts as regular accounts.
2. Unlimited behavior is expressed through policy caps/budgets, not through separate API/runtime branches.
3. No editor-open path may depend on a special `devstudio` payload shape.

**Implementation rule**
1. Keep one host-open payload and one Bob runtime path.
2. Keep policy resolution centralized; differentiate by policy content only.

### 3.11 Contract C11 - Local and Cloudflare behavior parity

**Parity contract**
1. If a workflow succeeds in local, it must succeed the same way in cloud-dev/prod.
2. Environment differences are limited to base URLs/credentials/deployment infra, not product behavior.

**Implementation rule**
1. Allowed environment differences: endpoint origins, credentials, Cloudflare bindings.
2. Forbidden environment differences: payload shape, subject mode, retry/timeout behavior, entitlement model, fallback semantics, delete/replace semantics.
3. Remove hostname-based behavior switches that alter runtime semantics.
4. Add mandatory local + cloud-dev parity checks in release gates.

### 3.12 Contract C12 - API file size limit

**Limit**
1. No API file exceeds 800 LOC.

**Implementation rule**
1. Split oversized handlers into route + service modules before or during functional changes in this PRD.
2. LOC check is a release gate, not optional cleanup.

---

## 4) Data model and storage migration plan

### M49-01 Remove soft-delete model (required)

**Target:** Supabase schema + code usage

1. Purge already-soft-deleted rows physically before dropping column.
2. Remove `deleted_at` column from `account_assets`.
3. Remove query filters depending on `deleted_at`.

**SQL migration (planned)**
```sql
BEGIN;

WITH doomed AS (
  SELECT asset_id, account_id
  FROM public.account_assets
  WHERE deleted_at IS NOT NULL
)
DELETE FROM public.account_asset_usage u
USING doomed d
WHERE u.asset_id = d.asset_id
  AND u.account_id = d.account_id;

WITH doomed AS (
  SELECT asset_id, account_id
  FROM public.account_assets
  WHERE deleted_at IS NOT NULL
)
DELETE FROM public.account_asset_variants v
USING doomed d
WHERE v.asset_id = d.asset_id
  AND v.account_id = d.account_id;

DELETE FROM public.account_assets
WHERE deleted_at IS NOT NULL;

ALTER TABLE public.account_assets
  DROP COLUMN IF EXISTS deleted_at;

COMMIT;
```

### M49-02 Replacement path support

1. No new core table required.
2. Keep `account_asset_variants` uniqueness (`asset_id`, `variant`) and update row on replacement.
3. Ensure delete path still cascades correctly after replacement updates.

### M49-03 Pointer cache behavior

1. No schema change.
2. Tokyo pointer response header change only (`no-store`).

### M49-04 Global reuse semantics

1. Keep account ownership model as canonical (`account_id` + `asset_id` namespace).
2. Keep `workspace_id/public_id/widget_type` as optional provenance only; never treat them as ownership gates.
3. Ensure attach/reuse writes usage mappings only (`account_asset_usage`), not duplicated asset rows.

### M49-05 Admin policy normalization

1. No schema migration required.
2. Policy issuance must represent admin unlimited behavior via policy caps/budgets within the same envelope model.
3. Remove standard editor dependence on special `subject=devstudio` runtime behavior.

### M49-06 API decomposition (tenet enforcement)

1. No data migration.
2. Decompose oversized API handlers into route + domain services with clear ownership boundaries.
3. Enforce 800-LOC file limit at release gate.

---

## 5) Ordered implementation plan (peer-review slices)

### PR49-A: Open contract convergence

**Files**
1. `roma/components/builder-domain.tsx`
2. `admin/src/html/tools/dev-widget-workspace.html`
3. shared helper file (new, reused by both hosts)

**Deliverables**
1. Single open lifecycle helper used by both hosts.
2. DevStudio runtime no hardcoded workspace ID for open path.
3. Builder path no dead-end when route has valid instance context.
4. Standard editor open payload uses `subjectMode: 'workspace'` in both hosts (including admin flows).

**Gate**
1. Same instance open in Roma and DevStudio yields same lifecycle events and user-visible errors.
2. No standard Bob open path emits `subjectMode: 'devstudio'`.

### PR49-B: Policy-on-auth cleanup

**Files**
1. `paris/src/domains/workspaces/index.ts`
2. `paris/src/shared/policy.ts`
3. `bob/lib/session/useWidgetSession.tsx`

**Deliverables**
1. Bob runtime uses loaded policy snapshot.
2. No runtime entitlement re-fetch after open.
3. Admin unlimited behavior is policy-driven within the same account policy envelope (no ad-hoc runtime branch).

**Gate**
1. Bob action gating works from loaded policy only; server still denies unauthorized writes.
2. Admin and non-admin accounts return the same policy shape; only policy values differ.

### PR49-C: Hard delete and soft-delete removal

**Files**
1. `supabase/migrations/*` (new migration for M49-01)
2. `tokyo-worker/src/index.ts`
3. `paris/src/domains/accounts/index.ts`
4. `roma/components/assets-domain.tsx`

**Deliverables**
1. Immediate hard delete behavior.
2. Remove `/assets/purge-deleted` runtime dependency.
3. Remove soft-delete response semantics.

**Gate**
1. Delete response returned -> pointer/object URLs 404 immediately.

### PR49-D: Replacement endpoint and immediate embed propagation

**Files**
1. `tokyo-worker/src/index.ts`
2. `paris/src/domains/accounts/index.ts`
3. `roma/app/api/paris/[...path]/route.ts` (proxy supports new endpoint)
4. `bob/app/api/assets/upload/route.ts`
5. `dieter/components/shared/assetUpload.ts`
6. `dieter/components/dropdown-upload/dropdown-upload.ts`
7. `dieter/components/dropdown-fill/dropdown-fill.ts`

**Deliverables**
1. Replace-in-place endpoint (same `assetId`, same pointer).
2. Upload helper supports optional replacement target.
3. Replace button uses replacement flow when existing canonical asset URL is present.
4. Reusing an existing asset in another instance does not create a new asset row by default.
5. Upload contract supports account-scoped uploads with optional workspace/public provenance fields.
6. Editor upload callers no longer fail when workspace context is absent for account-scoped upload.

**Gate**
1. Existing embeds refresh to new file via same pointer path without config rewrite.
2. Cross-instance reuse keeps the same `assetId`.
3. Upload without `x-workspace-id` succeeds for account-scoped path and returns canonical pointer.

### PR49-E: No-fallback + filename-only metadata

**Files**
1. `tokyo-worker/src/index.ts`
2. `bob/lib/session/useWidgetSession.tsx`
3. `dieter/components/dropdown-upload/dropdown-upload.ts`
4. `dieter/components/dropdown-fill/dropdown-fill.ts`

**Deliverables**
1. Pointer serving never substitutes assets.
2. Editor metadata write path stores filename-only meta (`{ name }`).
3. Missing-asset UI state is explicit and consistent in upload/fill controls (`Asset unavailable` + replace CTA).

**Gate**
1. Missing asset remains missing and visible.
2. Missing asset state matches the required copy and CTA behavior from C6.

### PR49-F: Bootstrap domain degradation

**Files**
1. `paris/src/domains/roma/index.ts`

**Deliverables**
1. Domain fanout uses partial success model.
2. `domainErrors` surfaced for failed domains.

**Gate**
1. Single domain failure does not 500 full auth context.

### PR49-G: Local <-> Cloudflare parity hardening

**Files**
1. `roma/components/builder-domain.tsx`
2. `admin/src/html/tools/dev-widget-workspace.html`
3. `bob/lib/env/*.ts`, `roma/lib/env/*.ts` (as needed)

**Deliverables**
1. Keep legitimate env config differences (origins/credentials/bindings) while removing behavior divergence.
2. Eliminate hostname-based branches that change product/runtime semantics.
3. Add parity checklist for local and cloud-dev execution of the same workflow matrix.

**Gate**
1. T-01, T-01b, T-02..T-09 pass in local and cloud-dev with the same expected behavior.

### PR49-H: API decomposition to <=800 LOC

**Files**
1. `tokyo-worker/src/index.ts`
2. `paris/src/domains/roma/index.ts`
3. `paris/src/domains/workspaces/index.ts`

**Deliverables**
1. Split oversized handlers into composable modules (routing, policy/auth, asset operations, bootstrap operations).
2. Keep behavior unchanged while extracting modules.
3. Add API LOC gate script that counts code lines only (excludes blanks/comments) to CI/review checklist.

**Gate**
1. No API file in scoped API surfaces (`tokyo-worker/src`, `paris/src/domains`, `roma/app/api`, `bob/app/api`) exceeds 800 LOC.

---

## 6) Verification plan (must be executable)

### 6.1 Environment and safety rules

1. Run in **local** first (`bash scripts/dev-up.sh`), then **cloud-dev**.
2. No destructive Supabase reset.
3. Use existing instances/accounts only (no instance creation for test setup unless explicitly approved).

### 6.2 Static gates

Run from repo root:

```bash
pnpm lint
pnpm typecheck
pnpm test:contracts
# Added in PR49-H
node scripts/ci/check-api-code-loc.mjs --max-code-loc 800
```

Expected:
1. All pass.
2. No contract drift in ck-contract checks.
3. No API file in scoped API surfaces exceeds 800 code LOC (comment/blank excluded).

### 6.3 API contract tests (local)

Set vars (local):

```bash
export TOKYO_BASE="http://localhost:4001"
export PARIS_BASE="http://localhost:3001"
export DEV_JWT="<dev_jwt_with_access>"
export ACCOUNT_ID="<uuid>"
export WORKSPACE_ID="<uuid>"
export ASSET_ID="<uuid_existing_asset_for_replace_delete>"
```

#### T-01 Upload returns canonical pointer
```bash
printf 'prd49-a-%s\n' \"$(date +%s)\" > /tmp/prd49-a.bin

curl -i -X POST "$TOKYO_BASE/assets/upload" \
  -H "Authorization: Bearer $DEV_JWT" \
  -H "x-account-id: $ACCOUNT_ID" \
  -H "x-workspace-id: $WORKSPACE_ID" \
  -H "x-filename: prd49-upload.png" \
  -H "x-variant: original" \
  -H "x-source: api" \
  -H "content-type: image/png" \
  --data-binary @/tmp/prd49-a.bin
```

Expected:
1. HTTP 200
2. JSON has `url` matching `/arsenale/a/{accountId}/{assetId}`

#### T-01b Account-scoped upload without workspace provenance
```bash
curl -i -X POST "$TOKYO_BASE/assets/upload" \
  -H "Authorization: Bearer $DEV_JWT" \
  -H "x-account-id: $ACCOUNT_ID" \
  -H "x-filename: prd49-account-scope.png" \
  -H "x-source: api" \
  -H "content-type: image/png" \
  --data-binary @/tmp/prd49-a.bin
```

Expected:
1. HTTP 200
2. Canonical pointer URL returned
3. Asset is reusable across instances in the same account namespace

#### T-02 Hard delete is immediate
```bash
curl -i -X DELETE "$TOKYO_BASE/assets/$ACCOUNT_ID/$ASSET_ID" \
  -H "Authorization: Bearer $DEV_JWT"

curl -i "$TOKYO_BASE/arsenale/a/$ACCOUNT_ID/$ASSET_ID"
```

Expected:
1. Delete returns HTTP 200 with `deleted: true`
2. Pointer GET returns HTTP 404 immediately

#### T-03 Replace keeps pointer and changes bytes
```bash
printf 'prd49-b-%s\n' \"$(date +%s)\" > /tmp/prd49-b.bin

# Baseline hash
curl -s "$TOKYO_BASE/arsenale/a/$ACCOUNT_ID/$ASSET_ID" | shasum -a 256

# Replace content in-place
curl -i -X PUT "$TOKYO_BASE/assets/$ACCOUNT_ID/$ASSET_ID" \
  -H "Authorization: Bearer $DEV_JWT" \
  -H "x-filename: prd49-replaced.png" \
  -H "content-type: image/png" \
  --data-binary @/tmp/prd49-b.bin

# New hash
curl -s "$TOKYO_BASE/arsenale/a/$ACCOUNT_ID/$ASSET_ID" | shasum -a 256
```

Expected:
1. PUT returns HTTP 200 and same pointer URL (`/arsenale/a/$ACCOUNT_ID/$ASSET_ID`)
2. Hash after replace is different from baseline
3. No 30s stale window

### 6.4 Runtime parity tests (local)

#### T-04 Roma vs DevStudio open parity
1. Open same `publicId` in Roma Builder and DevStudio tool.
2. Verify both emit same event order: `session-ready -> ack -> applied`.
3. Verify same error key on forced failure (bad session/request).

#### T-05 Missing asset no fallback
1. Delete an asset used in config.
2. Open widget in Bob.
3. Verify UI shows explicit missing state:
   - `Asset unavailable`
   - `Asset URL is unavailable. Replace file to restore preview.`
   - replace action remains available
4. Verify no alternate asset renders.

#### T-06 Filename-only metadata
1. Upload/replace through dropdown upload.
2. Inspect emitted meta payload for asset field.
3. Verify only `{ name }` remains (no `mime`, no `source`).

#### T-07 Global reuse across instances
1. Upload one asset once in instance A.
2. Reuse the same pointer URL in instance B (same account).
3. Verify no new `assetId` is created and both instances reference the same pointer.

#### T-08 Admin account parity (Roma + DevStudio)
1. Open the same instance in Roma and DevStudio with admin account context.
2. Verify same open payload shape and lifecycle events.
3. Verify unlimited behavior is derived from policy values, not from a special runtime branch.

#### T-09 Local vs Cloudflare parity
1. Run T-01, T-01b, T-02..T-08 in local.
2. Run the same flows in cloud-dev.
3. Verify behavior and error semantics match.

### 6.5 Cloud-dev validation

Repeat T-01, T-01b, T-02..T-09 on cloud-dev after local pass.

Required checks:
1. Pointer replacement visible immediately in live embed path.
2. No bootstrap full outage when one domain load fails.
3. No `deleted_at`-dependent behavior in logs/responses.
4. No local-only behavior branch appears in cloud-dev runtime.

---

## 7) Release gates

### Gate A (after PR49-A/B)
1. Open contract parity complete.
2. Policy snapshot runtime usage complete.

### Gate B (after PR49-C/D/E)
1. Hard delete complete.
2. Replacement complete.
3. No fallback + filename-only metadata complete.

### Gate C (after PR49-F)
1. Bootstrap degradation complete.
2. Full local + cloud-dev matrix pass.

### Gate D (after PR49-G/H)
1. Local/cloud parity hardening complete.
2. API decomposition complete.
3. 800-LOC API gate passes.

---

## 8) Rollback strategy (by slice, no repo reset)

1. Rollback is by feature flag/cutover toggle, not git reset/rebase.
2. Keep temporary toggles only until each gate passes.

Suggested temporary flags:
1. `CK_PRD49_SHARED_OPEN`
2. `CK_PRD49_HARD_DELETE`
3. `CK_PRD49_REPLACE_IN_PLACE`
4. `CK_PRD49_BOOTSTRAP_PARTIAL`

Flag removal rule:
1. Remove flag in the same milestone once gate is green in local + cloud-dev.

---

## 9) Peer-review checklist (pass/fail)

### Contract checks
1. One shared open helper used by both Roma and DevStudio.
2. DevStudio no longer depends on hardcoded workspace ID in open path.
3. `subjectMode` for standard editor open is identical across hosts.
4. Admin account open path uses the same payload and lifecycle as non-admin.

### Asset checks
1. Upload returns canonical pointer URL.
2. Delete performs hard delete (no soft lifecycle fields).
3. Replace endpoint keeps same pointer and updates bytes immediately.
4. Pointer headers are `no-store`.
5. No fallback substitution path exists.
6. Asset metadata written by editor is filename-only.
7. Cross-instance reuse keeps same `assetId` (no clone-by-attach).

### Bootstrap checks
1. Domain fanout cannot 500 full auth context for one domain failure.
2. `domainErrors` emitted for failed domains.

### Parity and code-shape checks
1. Local and cloud-dev runs produce the same product behavior for T-01, T-01b, T-02..T-09.
2. No API file in scoped API surfaces exceeds 800 LOC.

### Validation checks
1. T-01, T-01b, T-02..T-09 pass in local.
2. T-01, T-01b, T-02..T-09 pass in cloud-dev.
3. Lint/typecheck/contracts/LOC gates pass.

---

## 10) Acceptance criteria (release blocking)

1. Bob open behavior is identical in Roma and DevStudio for same instance.
2. Bob does not perform post-auth entitlement fetch loops for action gating.
3. Asset delete is immediate hard delete with no soft-delete runtime semantics.
4. Asset replacement keeps same pointer and updates embed output immediately.
5. Missing assets stay missing (no substitution fallback).
6. Asset metadata written by editor is filename-only.
7. Assets are reusable globally across unlimited instances within the same account with stable `assetId` pointers.
8. Admin in Roma and DevStudio is handled as a normal account policy profile (same contract shape, unlimited caps by policy values).
9. Bootstrap returns partial domains on partial failures instead of global 500.
10. Local and cloud-dev verification matrix is fully green with matching behavior.
11. No API file in scoped API surfaces exceeds 800 LOC.

---

## 11) References

1. `documentation/architecture/CONTEXT.md`
2. `documentation/strategy/WhyClickeen.md`
3. `Execution_Pipeline_Docs/02-Executing/049A__PRD__Editor_Contract_and_Admin_Account_Unification.md`
4. `Execution_Pipeline_Docs/02-Executing/049B__PRD__Global_Asset_Lifecycle_and_Reuse.md`
5. `Execution_Pipeline_Docs/02-Executing/049C__PRD__Bootstrap_Resilience_and_Local_Cloudflare_Parity.md`
6. `Execution_Pipeline_Docs/02-Executing/049D__PRD__API_Decomposition_and_Release_Governance.md`
7. `roma/components/builder-domain.tsx`
8. `admin/src/html/tools/dev-widget-workspace.html`
9. `paris/src/domains/workspaces/index.ts`
10. `paris/src/shared/policy.ts`
11. `paris/src/domains/accounts/index.ts`
12. `paris/src/domains/roma/index.ts`
13. `tokyo-worker/src/index.ts`
14. `dieter/components/shared/assetUpload.ts`
15. `dieter/components/dropdown-upload/dropdown-upload.ts`
16. `supabase/migrations/20260213160000__accounts_asset_domain_phase0.sql`
