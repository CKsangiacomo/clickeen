# PRD 46 — Account-Owned Asset Domain and Upload Convergence

**Status:** EXECUTING (in progress)
**Date:** 2026-02-13
**Owner:** Product Dev Team
**Reviewers:** Product Dev Team peers + Human Architect
**Environment scope:** Local first (`bash scripts/dev-up.sh`) then cloud-dev
**Type:** Architecture convergence + identity hardening + asset domain foundation
**User-facing change:** Yes (cleaner upload behavior, reusable account asset library foundation, consistent caps)

---

## 0) Executive Summary

This PRD converges all asset uploads to a single ownership invariant:

`Every uploaded asset belongs to exactly one accountId.`

Current implementation splits identity and routing across `workspace-assets` and `curated-assets`, with scope-based branching in Bob/DevStudio/Tokyo worker. That creates ownership ambiguity, exception paths, duplicated logic, and weak foundations for account-level asset management.

This PRD replaces scope-first uploads with account-first uploads, introduces an account-scoped asset domain, and standardizes contracts so DevStudio and product flows use the same pipeline.

This PRD does **not** change the existing multi-tenant collaboration model: workspaces remain the canonical boundary for membership/roles and user-instance ownership.

---

## 1) Why Now (Evidence From Current Runtime)

### 1.1 Upload ownership is currently split by context, not by account

1. Bob upload proxy branches by `scope=workspace|curated` and validates different header sets:
   - `bob/app/api/assets/upload/route.ts:58`
   - `bob/app/api/assets/upload/route.ts:79`
   - `bob/app/api/assets/upload/route.ts:89`
2. Bob publish flow decides upload scope from `publicId` shape:
   - `bob/lib/session/useWidgetSession.tsx:1506`
   - `bob/lib/session/useWidgetSession.tsx:1508`
3. Tokyo worker has separate write handlers and storage roots:
   - `tokyo-worker/src/index.ts:1465` (`workspace`)
   - `tokyo-worker/src/index.ts:1541` (`curated`)
   - `tokyo-worker/src/index.ts:1533` (`workspace-assets/...`)
   - `tokyo-worker/src/index.ts:1571` (`curated-assets/...`)
4. Tokyo local dev server duplicates the same split:
   - `tokyo/dev-server.mjs:571`
   - `tokyo/dev-server.mjs:855`

### 1.2 DevStudio has separate upload behavior and direct Tokyo coupling

1. DevStudio page uploads directly to Tokyo endpoints by scope and widget/public context:
   - `admin/src/html/tools/dev-widget-workspace.html:1762`
   - `admin/src/html/tools/dev-widget-workspace.html:1777`
   - `admin/src/html/tools/dev-widget-workspace.html:1782`
   - `admin/src/html/tools/dev-widget-workspace.html:1793`
2. DevStudio promotion rewrites local asset URLs and re-uploads with special local-to-cloud logic:
   - `admin/vite.config.ts:670`
   - `admin/vite.config.ts:703`
   - `admin/vite.config.ts:728`
   - `admin/vite.config.ts:731`

### 1.3 Budgets/caps are workspace-keyed, not account-keyed

1. Tokyo worker budget keys are persisted as `ws:{workspaceId}`:
   - `tokyo-worker/src/index.ts:1253`
   - `tokyo-worker/src/index.ts:1271`
2. Paris shared budget scope currently supports workspace/minibob/anon only:
   - `paris/src/shared/budgets.ts:4`
   - `paris/src/shared/budgets.ts:31`

### 1.4 There is no account asset domain for management/reuse

1. No dedicated table/domain for account-owned assets currently exists in Michael docs/migrations:
   - `documentation/services/michael.md`
   - `supabase/migrations/20251228000000__base.sql`
   - `supabase/migrations/20260105000000__workspaces.sql`
2. Assets are referenced by URL strings in config rewriting flows, not by asset domain IDs.

### 1.5 Consequence

The system cannot guarantee deterministic ownership, consistent enforcement, or elegant reuse/management at account boundary. This blocks the intended architecture for account-centric product capabilities.

### 1.6 Architecture Boundary Impact (explicit)

This PRD introduces an account layer above workspaces for asset ownership and upload metering.

Old model:

`workspace -> instances + members`

New model:

`account -> workspaces -> instances + members`
`       -> account-owned assets`

Design decisions in this PRD:

1. Assets are account-scoped and reusable across workspaces in the same account.
2. Workspaces remain the collaboration boundary (memberships, roles, user-instance ownership).
3. Upload metering keys by account, while capability gating remains workspace-tier + subject policy.
4. This is a foundation for future agency/account roll-up product capabilities, not a billing-system rewrite.

---

## 2) Architecture Alignment Target

This PRD directly aligns with:

1. `documentation/architecture/Tenets.md`
   - Tenet 0 (no hidden fallback behavior)
   - Tenet 2 (orchestrators as dumb pipes with strict contracts)
   - Tenet 3 (fail visibly)
2. `documentation/architecture/CONTEXT.md`
   - Pre-GA contract: strict contracts + fail-fast over implicit recovery
3. `documentation/architecture/Overview.md`
   - clear boundaries across Bob, Paris, Tokyo worker, Michael
4. `documentation/capabilities/multitenancy.md`
   - workspace is the collaboration and instance boundary (Figma model)
5. `documentation/services/michael.md`
   - user instances remain workspace-owned; no billing-system redesign in this scope

Design principle for this PRD:

- Identity ownership is explicit and canonical (`accountId`)
- Presentation fields (email/name) are mutable attributes, never identity keys
- Upload surfaces do not invent identity from widget/public/scope context
- Workspace ownership semantics remain unchanged for instances and memberships

---

## 3) Scope Decisions (What/Why/How)

### 3.1 In-scope

1. Replace scope-first upload ownership (`workspace`/`curated`) with account-first ownership.
2. Introduce account-owned Tokyo storage namespace.
3. Standardize upload contract across Bob, DevStudio, Tokyo worker.
4. Introduce account asset metadata domain in Michael.
5. Move **upload meter keying** to account scope while preserving workspace-tier + subject policy gating.
6. Keep compatibility for old asset URLs during migration.

### 3.2 Out-of-scope

1. Full account/billing redesign across all systems.
2. Full rewrite of instance data model.
3. New pricing-packaging features.
4. Signed private assets rollout (future PRD).
5. Any change to workspace ownership model, workspace member roles, or workspace-scoped instance APIs.
6. Full account-management UX (owner transfer, account member invites, billing portal).

---

## 4) Canonical Model (Target State)

### 4.1 Ownership invariant

`asset.ownerAccountId` is required and immutable after create.

### 4.2 Boundary invariants (multitenancy-compliant)

1. Workspaces remain the canonical collaboration boundary (memberships, roles, comments, user-instance ownership).
2. `widget_instances.workspace_id` remains required and authoritative for user instances.
3. Account boundary in this PRD is for asset ownership and upload metering only.
4. Subject policy + workspace tier remain the capability gate for editor/product behavior.

### 4.3 Account identity contract

1. `accountId` is an opaque UUID-like ID (same identity primitive style used across system IDs).
2. `accountId` is never email/name/provider key.
3. Email/name/provider links may change without touching asset ownership.

### 4.4 Tokyo canonical path

All new uploads write to:

`assets/accounts/{accountId}/{assetId}/{variant}/{filename}`

Notes:

1. Old paths remain readable during migration only:
   - `/workspace-assets/**`
   - `/curated-assets/**`
2. New write APIs stop writing to old roots after cutover.

### 4.5 One upload API contract (worker-authoritative)

New canonical endpoint in Tokyo worker:

`POST /assets/upload`

Required headers:

1. `Authorization: Bearer <TOKYO_DEV_JWT>` (dev/local/cloud-dev internal)
2. `x-account-id`
3. `x-filename`
4. `x-variant` (default `original` if omitted)
5. `content-type`

Optional trace headers:

1. `x-workspace-id`
2. `x-public-id`
3. `x-widget-type`
4. `x-source` (`bob.publish|bob.export|devstudio|promotion|api`)

Response shape (canonical):

```json
{
  "accountId": "uuid",
  "assetId": "uuid",
  "variant": "original",
  "filename": "hero-banner.jpg",
  "ext": "jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 12345,
  "key": "assets/accounts/<accountId>/<assetId>/<variant>/<filename>",
  "url": "https://tokyo.../assets/accounts/<accountId>/<assetId>/<variant>/<filename>"
}
```

Errors always use structured shape:

```json
{ "error": { "kind": "VALIDATION|DENY|INTERNAL", "reasonKey": "...", "detail": "..." } }
```

### 4.6 Curated Ownership Semantics

Curated instances are platform-owned content with global read semantics.

1. `curated_widget_instances.owner_account_id` is always set, and current curated rows backfill to `PLATFORM_ACCOUNT_ID`.
2. Curated visibility remains global-read behavior (not constrained to account members in this PRD).
3. Curated uploads/storage are attributed to `PLATFORM_ACCOUNT_ID` for operational accounting.
4. Customer account quotas and customer-facing asset library views exclude platform-curated assets by default.

---

## 5) Database Baseline (Inspected) and Required Delta

### 5.1 Deterministic inspection snapshot (local Supabase, 2026-02-13)

Inspection source:

1. Live local Postgres container (`supabase_db_clickeen`) queried directly.
2. Verified public tables include:
   - `widgets`
   - `widget_instances`
   - `workspaces`
   - `workspace_members`
   - `comments`
   - `curated_widget_instances`
   - `workspace_business_profiles`
   - `l10n_publish_state`
   - `l10n_overlay_versions`
   - `widget_instance_overlays`
   - `l10n_generate_state`
   - `l10n_base_snapshots`
   - `instance_enforcement_state`
3. Verified there is no public table matching `%account%`.
4. Verified current ownership columns:
   - `widget_instances.workspace_id` exists and is required.
   - `curated_widget_instances` has no `workspace_id` and no `account_id`.
   - `workspaces` has no `account_id`.
5. Verified current quota profile anchor:
   - `workspaces.tier` exists and is required.
6. Verified deterministic row counts at inspection time:
   - `workspaces = 2` (`ck-dev`, `ck-demo`)
   - `curated_widget_instances = 9`
   - `widget_instances = 0`
   - `workspace_members = 0`
7. Verified current FK/auth linkage:
   - `workspace_members.user_id -> auth.users(id)`
8. Verified existing RLS posture:
   - `workspaces`, `workspace_members`, `widget_instances`, `curated_widget_instances` all have `rowsecurity = true`.

Conclusion:

Current DB model is workspace-centric and does not yet contain a first-class account ownership primitive for assets.

### 5.2 Required new table: `accounts`

Purpose: canonical owner identity for assets and account-scoped metering.

Required columns:

1. `id uuid primary key`
2. `status text not null` (`active|disabled`)
3. `is_platform boolean not null default false`
4. `created_at timestamptz not null default now()`
5. `updated_at timestamptz not null default now()`

Required constraints:

1. `status` check constraint.

Required seed rows:

1. `PLATFORM_ACCOUNT_ID` with `is_platform=true`, `status=active` (internal unlimited account for curated/main/devstudio flows).
2. Account rows mapped from existing workspaces during backfill (one account per existing workspace for deterministic migration).

### 5.2.1 Account status behavior (explicit)

1. `status=active`:
   - account can upload assets and consume account-scoped upload budget.
2. `status=disabled`:
   - account upload writes are denied fail-visible (`DENY` with reason key like `account.disabled`).
   - existing assets remain readable during retention/deprecation windows unless explicitly removed by policy.

### 5.2.2 Account creation and backfill semantics (deterministic)

This PRD does not introduce account UX yet; accounts are system-managed records.

1. Backfill phase:
   - `ck-dev` and `ck-demo` map to `PLATFORM_ACCOUNT_ID`.
   - Any non-internal workspace maps to a newly created customer account row (`is_platform=false`, `status=active`).
2. Runtime create phase:
   - When a new workspace is created, Paris creates a customer account row in the same write transaction and sets `workspaces.account_id`.
3. User linkage for pricing/limits in this PRD:
   - Seat/usage roll-ups derive from `workspaces.account_id` joined through `workspace_members`.
   - No `account_members` table and no direct `accounts.owner_user_id` field are introduced in this PRD.

### 5.3 Required change: `workspaces.account_id`

Purpose: bind every workspace to one owning account.

Required migration changes:

1. Add `workspaces.account_id uuid` nullable first.
2. Backfill every workspace with deterministic account mapping.
3. Add foreign key `workspaces.account_id -> accounts.id`.
4. Set `workspaces.account_id` to `not null`.
5. Add index on `workspaces(account_id)`.

Deterministic backfill rule for this PRD:

1. Existing internal workspaces (`ck-dev`, `ck-demo`) map to `PLATFORM_ACCOUNT_ID`.
2. Any non-internal workspace rows map 1:1 to newly created customer accounts during migration (`is_platform=false`, `status=active`).

### 5.4 Required change: curated ownership binding

Purpose: remove implicit curated ownership and make it explicit.

Required migration changes:

1. Add `curated_widget_instances.owner_account_id uuid`.
2. Backfill all current curated rows to `PLATFORM_ACCOUNT_ID`.
3. Add foreign key `owner_account_id -> accounts.id`.
4. Set `owner_account_id` to `not null`.
5. Add index on `curated_widget_instances(owner_account_id)`.

### 5.5 New table: `account_assets`

Purpose: logical asset ownership + metadata by account.

Required columns:

1. `asset_id uuid primary key`
2. `account_id uuid not null references accounts(id)`
3. `workspace_id uuid null references workspaces(id) on delete set null` (trace)
4. `public_id text null` (trace)
5. `widget_type text null` (trace)
6. `source text not null` (`bob.publish|bob.export|devstudio|promotion|api`)
7. `original_filename text not null`
8. `normalized_filename text not null`
9. `content_type text not null`
10. `size_bytes bigint not null`
11. `sha256 text null` (optimization, not required for first cutover gate)
12. `deleted_at timestamptz null` (soft-delete marker)
13. `created_at timestamptz not null default now()`
14. `updated_at timestamptz not null default now()`

Required indexes:

1. `(account_id, created_at desc)`
2. `(account_id, asset_id)`
3. optional `(account_id, sha256)`

### 5.5.1 Trace metadata policy (scope and retention)

Trace fields in `account_assets` are operational metadata, not presentation data.

1. `workspace_id` + `source` are used for attribution, debugging, and deterministic migration/rewrite diagnostics.
2. `public_id` + `widget_type` are used for reverse lookup during publish/export/promote rewrite paths.
3. Retention policy:
   - active assets keep trace metadata.
   - soft-deleted assets are purged (DB rows + R2 objects) after a 30-day retention window.
4. Trace metadata is never used as ownership authority; `account_id` remains the only ownership key.

### 5.6 New table: `account_asset_variants`

Purpose: map logical assets to Tokyo object keys per variant.

Required columns:

1. `asset_id uuid not null references account_assets(asset_id) on delete cascade`
2. `account_id uuid not null references accounts(id)`
3. `variant text not null`
4. `r2_key text not null unique`
5. `filename text not null`
6. `content_type text not null`
7. `size_bytes bigint not null`
8. `created_at timestamptz not null default now()`

Required constraints:

1. unique `(asset_id, variant)`
2. variant format check (`^[a-z0-9][a-z0-9_-]{0,31}$`)

### 5.7 Required RLS policy posture (pre-GA)

For this PRD execution window:

1. `accounts`, `account_assets`, `account_asset_variants` are service-role write surfaces.
2. Account-scoped reads for product/UI flow through Paris APIs (server-authorized), not direct client SQL.
3. No browser-direct write policy is introduced in this PRD.
4. Curated instance global-read behavior remains unchanged; `owner_account_id` is an ownership primitive, not a new curated visibility gate.

---

## 6) Service Workstreams

## 6.1 Workstream A — Ownership resolution contract in Paris/Bob

### What

Emit `ownerAccountId` in Bob load context for every instance session.

### Why

Upload ownership must not be inferred from scope branches.

### How

1. Extend Paris instance read responses to include `ownerAccountId`.
2. Extend Bob bootstrap/session meta to carry `ownerAccountId`.
3. Persist utilities (`persistConfigAssetsToTokyo`) require `accountId` and stop accepting scope branch as ownership primitive.
4. Update workspace-create service path to assign `workspaces.account_id` deterministically for every new workspace.

### Gate

No asset upload call path can proceed without explicit `accountId`.

## 6.2 Workstream B — Tokyo worker canonical upload endpoint

### What

Implement `POST /assets/upload` and `GET /assets/accounts/**` as canonical path.

### Why

Single contract + single namespace eliminates path split and exception complexity.

### How

1. Add handler `handleUploadAccountAsset`.
2. Validate `x-account-id`, auth, variant, payload.
3. Write to `assets/accounts/{accountId}/{assetId}/{variant}/{filename}`.
4. Emit canonical response shape.
5. Keep `workspace-assets` and `curated-assets` reads for compatibility.
6. Mark old write endpoints as deprecated and eventually remove.

### Gate

All new writes in local/cloud-dev use `/assets/upload` only.

## 6.3 Workstream C — Bob upload proxy convergence

### What

Refactor `bob/app/api/assets/upload/route.ts` to account-first forwarding.

### Why

Remove scope branching and make Bob a strict proxy pipe.

### How

1. Remove `scope` query as ownership selector.
2. Accept/resolve `accountId` server-side from session context.
3. Forward only canonical headers to Tokyo worker.
4. Keep structured error propagation.

### Gate

`scope=workspace|curated` no longer controls ownership in Bob upload route.

## 6.4 Workstream D — DevStudio convergence (no exception path)

### What

Move DevStudio upload flows to the same account-first contract.

### Why

DevStudio must not have special ownership semantics.

### How

1. Update `admin/src/html/tools/dev-widget-workspace.html` upload helper to call canonical account upload route.
2. Update promotion rewrite path in `admin/vite.config.ts` to re-upload through canonical account contract.
3. For curated/main flows use `PLATFORM_ACCOUNT_ID`.
4. Keep read-only behavior in cloud DevStudio intact.

### Gate

No DevStudio code path writes assets via legacy scope ownership contract.

## 6.5 Workstream E — Account-scoped upload caps and budgets

### What

Shift upload metering keys from workspace scope to account scope.

### Why

Asset ownership and upload metering boundaries must match.

### How

1. Extend budget scope model with `{ kind: 'account'; accountId: string }` for upload metering:
   - `paris/src/shared/budgets.ts`
2. Tokyo worker consumes upload budgets by account scope.
3. Preserve existing workspace-tier + subject policy values (`config/entitlements.matrix.json`) for capability gating.
4. `PLATFORM_ACCOUNT_ID` resolves to uncapped profile (`devstudio` or explicit unlimited profile).

### Gate

Upload budget counters are keyed by account identity, not workspace identity.

## 6.6 Workstream F — Asset management APIs (foundation)

### What

Expose account asset domain for list/reuse/delete lifecycle.

### Why

This is the foundation for reusable asset UX and operational management.

### How

1. Add Paris endpoints (dev/internal first):
   - `GET /api/accounts/:accountId/assets`
   - `GET /api/accounts/:accountId/assets/:assetId`
   - `DELETE /api/accounts/:accountId/assets/:assetId`
2. Enforce ownership auth and soft-delete semantics.
3. Keep hard-delete behind explicit internal action.
4. Soft-delete sets `deleted_at`; purge job removes soft-deleted assets after 30 days.

### Gate

Account-level listing and reuse metadata is available without scraping config URLs.

---

## 7) Migration Strategy (Pre-GA, Zero Destructive Resets)

## 7.0 Phase 0 — DB foundation (required before service cutover)

1. Create `accounts`.
2. Add `workspaces.account_id` (nullable), backfill, FK, index, then `not null`.
3. Add `curated_widget_instances.owner_account_id` (nullable), backfill to `PLATFORM_ACCOUNT_ID`, FK, index, then `not null`.
4. Create `account_assets`.
5. Create `account_asset_variants`.
6. Apply RLS/policies for new tables (service-role writes; no browser-direct writes in this PRD).
7. Update workspace-create flow so all future workspace rows are written with non-null `account_id`.

Phase 0 deterministic gate:

1. `accounts` exists and includes seeded `PLATFORM_ACCOUNT_ID` (`is_platform=true`, `status=active`).
2. `workspaces.account_id` exists and all rows are non-null.
3. `curated_widget_instances.owner_account_id` exists and all rows are non-null.
4. New asset tables and constraints are present.
5. New workspace creation path persists non-null `account_id` deterministically.

## 7.1 Phase 1 — Introduce new upload contract without breaking reads

1. Ship new `POST /assets/upload` endpoint and path.
2. Bob/DevStudio write new assets only to account root.
3. Old URL reads remain supported.

## 7.2 Phase 2 — Progressive config rewrite

1. On publish/export/promote, when old asset URLs are found:
   - re-upload or map into account asset domain
   - rewrite config URL to new canonical path
2. Do not block publish if old URL still resolves (fail-visible warning logged).

## 7.3 Phase 3 — Backfill curated/main first

1. Backfill internal curated/main instances to account-owned paths.
2. Validate Prague/Venice render parity after rewrite.

## 7.4 Phase 4 — Account-budget cutover

1. Switch upload metering keys from `ws:{workspaceId}` to `acct:{accountId}`.
2. Keep budget values/tier matrix unchanged.
3. Validate platform account uncapped behavior explicitly.

## 7.5 Phase 5 — Decommission old write paths

1. Remove `/workspace-assets/upload` and `/curated-assets/upload` writes.
2. Keep legacy reads temporarily for compatibility window.
3. Remove legacy reads only after measured zero references.

---

## 8) Acceptance Criteria (Peer-Review Gates)

### 8.1 Functional

1. All upload write requests include resolved `accountId`.
2. Tokyo worker writes new uploads only under `/assets/accounts/{accountId}/...`.
3. DevStudio and Bob use same upload contract and response shape.
4. Asset filenames are preserved/sanitized consistently.

### 8.2 Architecture

1. No scope-based ownership branching in Bob upload route.
2. No direct ownership inference from `workspaceId/publicId/widgetType`.
3. Structured worker error shape is preserved end-to-end.
4. Ownership identity is opaque ID only (no email/name path coupling).
5. Workspace collaboration semantics remain unchanged (`workspace_members` roles + workspace-owned user instances).

### 8.3 Data Domain

1. `accounts` exists with required status checks and platform marker (`is_platform`) and seeded `PLATFORM_ACCOUNT_ID`.
2. `workspaces.account_id` exists, is FK-linked to `accounts(id)`, indexed, and non-null for all rows.
3. `curated_widget_instances.owner_account_id` exists, is FK-linked to `accounts(id)`, indexed, and non-null for all rows.
4. `account_assets` + `account_asset_variants` exist with required unique/check constraints and RLS/service-role posture as defined.
5. List/reuse/delete APIs return deterministic account-scoped results.
6. Old assets remain readable during migration.
7. Curated global-read behavior remains unchanged after `owner_account_id` introduction.

### 8.4 Metering

1. Upload budgets key by account scope.
2. Platform account is uncapped by policy.
3. No regression to existing non-upload budgets.
4. Customer quota/read views exclude platform-curated assets by default.

---

## 9) Risks and Mitigations

1. Risk: ownership resolution gaps for some legacy flows.
   - Mitigation: explicit `ownerAccountId` required in Bob session bootstrap; fail-fast if missing.
2. Risk: migration churn in configs with legacy URLs.
   - Mitigation: staged rewrite on publish/export; compatibility reads retained.
3. Risk: budget regressions after scope-key change.
   - Mitigation: dual-read metrics during cutover + explicit account-scope counters.
4. Risk: cross-team merge conflicts in high-traffic files.
   - Mitigation: execute in isolated workstreams, smallest possible diffs, strict phase ordering.
5. Risk: workspace rows created without `account_id` after cutover.
   - Mitigation: ship workspace-create flow update in Phase 0 and gate with integration coverage.

---

## 10) Execution Order (Recommended)

1. **Phase 0:** DB foundation migrations (`accounts`, ownership columns, asset tables, policy posture).
2. **Phase A:** Ownership resolution contract + Bob session meta (`ownerAccountId`).
3. **Phase B:** Tokyo worker canonical upload endpoint + canonical path writes.
4. **Phase C:** Bob upload route migration to account-first.
5. **Phase D:** DevStudio + promotion convergence.
6. **Phase E:** Paris account asset APIs + config rewrite/backfill mechanics.
7. **Phase F:** Budget scope migration to account + legacy write endpoint removal.

---

## 11) Rollback Strategy

1. Keep legacy read routes available through execution phases.
2. Feature-flag canonical upload path by environment toggle for short rollback window.
3. If severe regressions appear:
   - stop new-path writes
   - revert to previous write handlers
   - keep already uploaded new-path assets readable (no destructive delete)

---

## 12) File-Level Impact Map (Initial)

Primary implementation files expected:

1. `bob/app/api/assets/upload/route.ts`
2. `bob/lib/assets/persistConfigAssetsToTokyo.ts`
3. `bob/lib/session/useWidgetSession.tsx`
4. `tokyo-worker/src/index.ts`
5. `tokyo/dev-server.mjs` (local parity)
6. `admin/src/html/tools/dev-widget-workspace.html`
7. `admin/vite.config.ts`
8. `paris/src/shared/budgets.ts`
9. `paris/src/domains/workspaces/index.ts`
10. `documentation/services/bob.md`
11. `documentation/services/tokyo.md`
12. `documentation/services/tokyo-worker.md`
13. `documentation/services/devstudio.md`
14. `documentation/services/michael.md`
15. new migration(s) in `supabase/migrations/*` for DB foundation:
    - `accounts`
    - `workspaces.account_id`
    - `curated_widget_instances.owner_account_id`
    - `account_assets`
    - `account_asset_variants`

---

## 13) Peer Review Checklist (Required)

1. **Elegant engineering/scalability:**
   - Does one ownership invariant remove branching complexity across Bob/DevStudio/Tokyo?
2. **Architecture compliance:**
   - Does identity remain strict (`accountId`) and fail-visible?
3. **No over-architecture:**
   - Is the PRD scoped to upload/domain convergence without broad auth/billing rewrites?
4. **Moves toward target architecture:**
   - Does this unlock account-level asset management/reuse/caps as first-class platform behavior?

---

## 14) Final Note

This PRD treats account ownership as the boundary for uploaded assets while preserving workspace as the canonical collaboration and instance boundary. That separation improves correctness and operability without changing the Figma-model tenancy contract.

---

## 15) Contract Diff (Current -> Target)

### 15.1 Upload route contract

Current:

1. Bob route accepts `?scope=workspace|curated`.
2. Ownership inferred via `x-workspace-id` OR (`x-public-id` + `x-widget-type`).
3. Tokyo worker writes to split roots:
   - `/workspace-assets/...`
   - `/curated-assets/...`

Target:

1. Bob route does not accept ownership scope query.
2. Ownership resolved as `accountId` in server context.
3. Tokyo worker writes only to:
   - `/assets/accounts/{accountId}/{assetId}/{variant}/{filename}`

### 15.2 Identity resolution contract

Current:

1. Upload ownership and path are context-derived from instance class.
2. No first-class account ownership in upload contract.

Target:

1. Every upload has one explicit owner: `accountId`.
2. `workspaceId/publicId/widgetType` become trace metadata only.
3. `accountId` is immutable and opaque.

### 15.3 Budget scope contract

Current:

1. Upload budget counters use workspace key (`ws:{workspaceId}`).

Target:

1. Upload budget counters use account key (`acct:{accountId}`).
2. Existing budget value matrix remains unchanged for this PRD.

---

## 16) Migration Mechanics (Detailed)

### 16.1 No-destructive policy

1. No Supabase resets.
2. No bulk hard-delete of old assets during migration.
3. Legacy asset URLs remain readable until cutover completion gate.

### 16.2 Progressive rewrite algorithm

Applied during publish/export/promote:

1. Traverse config values.
2. For each URL-like value:
   - if already `/assets/accounts/...`, keep.
   - if `/workspace-assets/...` or `/curated-assets/...`, migrate.
3. Migration step:
   - fetch object bytes from old URL
   - upload via canonical account endpoint
   - replace URL in config with canonical URL
4. Persist updated config.

### 16.3 Backfill order

1. Curated/main instances first (platform-owned and deterministic set).
2. User instances second (opportunistic on publish + optional background batch).
3. Remove legacy write endpoints only after:
   - zero writes observed to old paths for defined burn-in window.

### 16.4 Idempotency and dedupe

1. Canonical upload accepts optional idempotency key (`x-idempotency-key`) in later subphase.
2. Optional SHA-256 dedupe is metadata-level optimization, not a gate for initial rollout.

---

## 17) Validation Matrix (Execution Gates)

### 17.1 Unit/service validation

1. Bob upload route rejects missing `accountId`.
2. Tokyo worker rejects invalid `x-account-id`.
3. Tokyo worker returns canonical JSON shape for success/error.
4. Budget keys write under `acct:` scope for uploads.
5. Migration-level checks assert:
   - `accounts` contains `PLATFORM_ACCOUNT_ID`
   - `workspaces.account_id` has zero null rows
   - `curated_widget_instances.owner_account_id` has zero null rows
6. Workspace-create integration asserts new workspaces are persisted with non-null `account_id`.

### 17.2 Integration validation (local)

1. DevStudio local upload -> Bob/Tokyo canonical path.
2. Bob publish with blob/data URLs rewrites to canonical account URLs.
3. Curated publish path uses `PLATFORM_ACCOUNT_ID` and succeeds.
4. Legacy URL read compatibility still works.

### 17.3 Integration validation (cloud-dev)

1. End-to-end upload from Bob cloud-dev writes canonical path.
2. DevStudio cloud read-only mode remains read-only.
3. Promotion flow rewrites old local URLs to canonical cloud account URLs.

### 17.4 Regression validation

1. No regression in Prague/Venice renders when configs contain mixed old/new URLs.
2. No regression in l10n publish/snapshot flows.
3. No regression in existing non-upload budget counters.
4. No regression in curated instance global-read behavior.

---

## 18) Observability and Metrics

### 18.1 Logging requirements

For every upload attempt, log:

1. `requestId`
2. `accountId`
3. `workspaceId` (if present)
4. `publicId` (if present)
5. `source`
6. `bytes`
7. `result` (`ok|deny|validation_error|internal_error`)
8. `reasonKey` (on errors)

### 18.2 KPIs for cutover

1. `% writes to canonical path` (target 100% before legacy write removal).
2. `legacy read hit rate` (must trend down before legacy read removal).
3. `upload failure rate` split by source.
4. `median/p95 upload latency`.
5. `budget deny rate` split by profile.

---

## 19) Phase-by-Phase Deliverables

### Phase 0 deliverables

1. `accounts` table + seed row (`PLATFORM_ACCOUNT_ID`) shipped.
2. `workspaces.account_id` shipped with FK/index and non-null backfill.
3. `curated_widget_instances.owner_account_id` shipped with FK/index and non-null backfill.
4. `account_assets` + `account_asset_variants` shipped with required constraints/policies.
5. Workspace-create flow ships with deterministic `account_id` assignment.

### Phase A deliverables

1. `ownerAccountId` in instance/session payloads.
2. Bob session state carries owner account context.

### Phase B deliverables

1. Tokyo worker `POST /assets/upload`.
2. Tokyo canonical storage root writes.

### Phase C deliverables

1. Bob upload proxy switched to account-first forwarding.
2. Scope-owned write semantics removed from Bob upload route.

### Phase D deliverables

1. DevStudio upload helper switched to account-first.
2. Promotion rewrite switched to account-first.

### Phase E deliverables

1. Paris account asset list/get/delete APIs shipped (internal first).
2. Config rewrite/backfill hooks shipped for publish/export/promote paths.
3. Soft-delete + 30-day purge lifecycle for account assets is operational.

### Phase F deliverables

1. Upload budgets keyed by account scope.
2. Legacy write endpoints removed.
3. Legacy reads retained until final deprecation PRD.
