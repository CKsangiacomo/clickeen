# PRD 55 — Supabase Eviction for Overlays, Assets, L10n, Runtime Ephemeral State, Account Enrichment, and Notices (R2/KV Cutover)

Status: EXECUTED (with systemic regressions; remediated by subsequent PRDs)  
Date: 2026-03-04  
Owner: Product Dev Team  
Priority: P0

> **Execution Note (2026-03-05):** This PRD was executed and moved to `03-Executed`. Multiple parts of the rollout caused systemic failures across auth, runtime, and storage contracts. Those failures are addressed by subsequent PRDs (starting with PRD 56 and follow-ons). Treat this document as execution history, not the current runtime source of truth.

Environment contract:
- Canonical integration truth: cloud-dev (Cloudflare + shared remote Supabase "Michael").
- Local is for fast building-block iteration only; canonical startup remains `bash scripts/dev-up.sh`.
- Supabase migrations must be applied to cloud-dev before cloud deploy (CI gate).
- Destructive Supabase resets are prohibited by default.

Pre-GA posture (locked):
- We are PRE-GA with zero production users.
- We prefer clean cutovers over long-lived compatibility layers.
- No permanent dual-write architecture is allowed.
- One target state only: relational data in Supabase, keyed documents in R2, ephemeral state in KV.

---

## One-line objective

Remove non-relational document/state workloads from Supabase and complete the storage boundary:

- Relational ownership/authorization data remains in Supabase.
- Overlay/content documents move to R2.
- Transient l10n pipeline state moves to KV (with snapshots in R2).
- Remove view-cap freeze/runtime health state from Supabase and hard-cut non-essential enforcement paths.
- Move account enrichment/business profile documents from Supabase to R2.
- Remove premature notification table modeling and collapse current lifecycle notice state into `accounts` fields.

---

## Why this PRD exists

Current runtime uses Supabase/PostgREST for data that is not relational and is accessed as key-value documents. That causes:

1. Avoidable request fan-out and latency from multi-call PostgREST flows.
2. Source-of-truth drift between R2 and Supabase mirrors for assets.
3. Queue-like state machine logic in SQL for l10n retries/staleness.
4. Schema/migration churn on tables that should not exist.

This directly slows pre-GA development and increases break risk.

---

## Core financial constraint (non-negotiable)

Clickeen must not require ongoing runtime tuning to stay cost-safe under traffic.  
If the platform only survives by continuously tuning dynamic paths, we will spend margin and engineering time faster than we can grow, which is a bankruptcy risk pre-GA.

This PRD is therefore also a financial survivability cut:

1. Published-view steady state must be CDN-cache-first (R2 artifacts + cacheable pointers), not DB-call-first.
2. Supabase is control-plane only for this scope (ownership/auth/relational records), not per-view data serving.
3. No per-view hot-path writes for enforcement/health/l10n progress in published render traffic.
4. Prefer hard cutovers that remove runtime dependencies over compatibility layers that preserve cost-heavy behavior.
5. Any phase change that increases dynamic no-store traffic or DB fan-out on render paths fails review.
6. View traffic is not a publish/edit gate; free/tier users must not be frozen by impression volume.

Success condition:
- Traffic growth should scale mostly with CDN egress/edge cache hit ratio, not with Supabase query volume or manual operator tuning.

---

## Before vs After (system behavior)

### Before (wrong behavior)

1. Overlay upsert/read/delete is DB-first (`widget_instance_overlays`) through PostgREST.
2. Asset lifecycle writes both R2 and Supabase mirror tables (`account_assets`, `account_asset_variants`, `account_asset_usage`).
3. L10n generate state is polled/updated in SQL (`l10n_generate_state`) with retry scheduling in DB queries.
4. L10n base snapshots are stored in SQL (`l10n_base_snapshots`).
5. Dead l10n tables still exist in schema (`l10n_overlay_versions`, `l10n_publish_state`) despite 0 runtime TS refs.
6. View-cap freeze path (`instance_enforcement_state`) blocks edit/publish and adds cron + DB lifecycle complexity.
7. Dormant render health table (`instance_render_health`) exists without meaningful wired runtime value.
8. Account enrichment/business profile is currently stored as mutable table state (`account_business_profiles`) instead of R2 account documents.
9. Lifecycle notices are modeled as a separate table (`account_notices`) before the real notification service exists.

### After (intended behavior)

1. Overlays are stored by key in R2 and read/written directly by Paris.
2. Assets are R2-only for metadata/object existence; Supabase asset mirrors are removed.
3. L10n state rows become KV entries; snapshots live in R2.
4. Supabase keeps only relational ownership/auth/instance records.
5. CI and runtime preflight enforce schema/storage contracts so drift is detected immediately.
6. No view-based freeze enforcement exists in runtime; usage metering is non-blocking telemetry only.
7. Account enrichment is stored as R2 account documents (`profile.json`) with no Supabase profile table.
8. Current lifecycle notice UX (tier-drop) is derived from account lifecycle columns, not a separate notices table.

---

## Scope

In scope:
- Cut over the following tables away from Supabase:
  - `widget_instance_overlays`
  - `account_assets`
  - `account_asset_variants`
  - `account_asset_usage`
  - `l10n_generate_state`
  - `l10n_base_snapshots`
  - `l10n_overlay_versions` (drop)
  - `l10n_publish_state` (drop)
  - `instance_enforcement_state`
  - `instance_render_health`
  - `account_business_profiles`
  - `account_notices`
- Update Paris/Tokyo-worker/SanFrancisco runtime code paths to use R2/KV.
- Remove runtime view-cap freeze enforcement path end-to-end (Paris + Bob + scheduled cleanup).
- Replace notice-table workflows with `accounts` lifecycle fields for the current tier-drop UX.
- Update migration and preflight gates to prevent environment drift.
- Update architecture docs in the same PRs when behavior changes.

Out of scope:
- New user-facing features.
- Billing model changes.
- Widget schema redesign unrelated to storage boundary.
- Design/build of a future full notification service (multi-channel templates/preferences/scheduling).

---

## Source-of-truth matrix (target)

| Data category | Source of truth |
|---|---|
| Accounts, memberships, instance ownership/status | Supabase |
| Overlay docs keyed by `(publicId, layer, layerKey)` | R2 |
| Account asset blobs + metadata | R2 |
| L10n transient generation state | KV |
| L10n base snapshots | R2 |
| Usage telemetry counters (non-gating) | KV |
| Account enrichment profile documents (`profile.json` per account) | R2 |
| Current lifecycle notice state (tier-drop modal/email flags) | Supabase `accounts` columns |

Rule of thumb:
- Relational with joins/RLS/FKs -> Supabase.
- Document keyed by path -> R2.
- Ephemeral execution state -> KV.

---

## Surviving Supabase tables (post PRD 55 completion)

The following tables are expected to remain active after all Phase 1-8 cuts in this PRD:

| Table | Why it survives PRD 55 |
|---|---|
| `accounts` | Tenant identity, status, tier, billing controls. |
| `account_members` | Membership and role authorization. |
| `widgets` | Widget registry/type metadata. |
| `widget_instances` | Canonical base config + publish status + account ownership. |
| `curated_widget_instances` | Curated/template instance registry. |
| `comments` | User-generated comment records. |

---

## Execution sequence (locked)

Order is intentional to reduce drift and unblock fastest.

### Phase 1 — Drop dead tables first

Objective:
- Remove schema objects with zero runtime TS references:
  - `l10n_overlay_versions`
  - `l10n_publish_state`

Implementation:
1. Add migration dropping both tables.
2. Remove any leftover type references if present.
3. Update schema preflight to stop probing these tables (if probed).

Done criteria (gate):
1. Runtime TS references are zero for both names.
2. Cloud-dev migration applied and `supabase migration list` shows sync.
3. Cloud-dev deploy passes schema preflight.

Rollback boundary:
- Recreate tables via forward migration only if needed (no reset).

---

### Phase 2 — Overlays: Supabase -> R2

Objective:
- Replace `widget_instance_overlays` with R2 overlay objects.

Storage contract:
- R2 key: `overlays/{publicId}/{layer}/{layerKey}.json`
- JSON shape remains equivalent to current overlay row contract.

Implementation:
1. Add Paris R2 binding (`OVERLAYS_R2`) in `paris/wrangler.toml` (+ local env) and `Env` type.
2. Add shared overlay store module in Paris.
3. Replace overlay reads/writes in:
   - `paris/src/domains/l10n/service.ts`
   - `paris/src/domains/l10n/layers-handlers.ts`
   - `paris/src/domains/account-instances/service.ts`
   - `paris/src/domains/account-instances/create-handler.ts`
   - `paris/src/domains/account-instances/update-handler.ts`
   - `paris/src/domains/l10n/account-handlers.ts` (overlay reads used for mirror materialization)
   - `paris/src/shared/handlers.ts` (`SCHEMA_PROBES`: remove `widget_instance_overlays` table probe)
4. One-time backfill script:
   - read all `widget_instance_overlays` rows from Supabase
   - write each to R2 object key
   - emit migrated row counts and run spot checks
5. Cut reads to R2 only.
6. After validation, drop `widget_instance_overlays`.

Done criteria (gate):
1. No runtime read/write path for overlays uses `/rest/v1/widget_instance_overlays`.
2. Backfill counts match and spot-checks pass for cloud-dev accounts.
3. Editor overlay update + delete + publish mirror work in cloud-dev Roma for all active widgets.
4. `widget_instance_overlays` dropped via migration and preflight updated.

Rollback boundary:
- Before table drop: revert code to Supabase reads/writes if needed.
- After table drop: restore from R2 backfill artifacts via forward migration/script only.

---

### Phase 3 — Assets: Supabase mirrors -> R2-only

Objective:
- Remove Supabase asset mirror tables and keep asset truth only in R2.

Implementation:
1. Tokyo-worker:
   - stop writing to `/rest/v1/account_assets`
   - stop writing to `/rest/v1/account_asset_variants`
   - stop writing to `/rest/v1/account_asset_usage`
   - use R2 `head/list/delete` for identity + variants + purge flows
2. Paris:
   - replace `account_assets` reads in account assets list/usage/billing paths with R2-backed reads
   - remove `sync_account_asset_usage` RPC dependency from validation paths
   - update `paris/src/shared/handlers.ts` (`SCHEMA_PROBES`) to remove asset-table probes that are dropped in this phase
3. Drop tables:
   - `account_assets`
   - `account_asset_variants`
   - `account_asset_usage`

Done criteria (gate):
1. Upload/list/delete/purge asset flows succeed in cloud-dev Roma/Tokyo.
2. No runtime calls to the three removed asset tables or `sync_account_asset_usage` RPC.
3. Migrations applied in cloud-dev and schema preflight updated.

Rollback boundary:
- Before table drop: revert runtime reads/writes to existing tables.
- After table drop: forward-only recovery (recreate schema + optional backfill from R2 manifests).

---

### Phase 4 — L10n state: SQL -> KV/R2

Objective:
- Move l10n execution state out of Supabase:
  - `l10n_generate_state` -> KV
  - `l10n_base_snapshots` -> R2

KV namespace decision (locked):
- Phase 4 introduces a dedicated binding: `L10N_STATE_KV`.
- `USAGE_KV` remains budget/usage-only and must not store l10n generate-state keys.

Implementation:
1. Add `L10N_STATE_KV` to `paris/wrangler.toml` (cloud-dev and `env.local`) and `paris/src/shared/types.ts`.
2. Replace `loadL10nGenerateStateRow`, `loadL10nGenerateStates`, `upsertL10nGenerateStates`, `supersedeL10nGenerateStates`, `updateL10nGenerateStatus` with `env.L10N_STATE_KV`-backed functions.
3. Replace pending-state poll in `generate-handlers` with KV index/list strategy.
4. Replace snapshot read/write with R2:
   - key: `l10n/snapshots/{publicId}/{baseFingerprint}.json`
   - maintain `latest.json` pointer per `publicId` for current behavior parity.
5. Remove SQL table reads in account-instance status paths.
6. Drop:
   - `l10n_generate_state`
   - `l10n_base_snapshots`

Done criteria (gate):
1. L10n enqueue/report/requeue/status flows work in cloud-dev.
2. No runtime calls to `/rest/v1/l10n_generate_state` or `/rest/v1/l10n_base_snapshots`.
3. Both tables dropped and schema preflight updated.
4. `L10N_STATE_KV` binding exists in Paris cloud-dev and local config; l10n state keys are not written to `USAGE_KV`.

Rollback boundary:
- Before table drop: restore SQL-backed service implementation.
- After table drop: forward-only re-create + hydrate from KV/R2 if required.

---

### Phase 5 — Remove view-cap freeze path and drop `instance_enforcement_state`

Objective:
- Remove the freeze-by-views enforcement model from runtime and storage.

Implementation:
1. Paris usage pipeline:
   - remove `instance_enforcement_state` read/write/delete code paths from `paris/src/domains/usage/index.ts`
   - keep `/api/usage` as best-effort telemetry only (non-gating)
2. Paris account-instance APIs:
   - remove enforcement reads from `paris/src/domains/account-instances/read-handlers.ts`
   - remove freeze-deny checks from `paris/src/domains/account-instances/update-handler.ts`
   - remove now-unused enforcement helpers/types in `paris/src/domains/account-instances/service.ts` and helpers
3. Bob editor runtime:
   - remove frozen gating/upsell behavior in `bob/lib/session/useWidgetSession.tsx`
4. Scheduled cleanup:
   - remove `handleFrozenResets` invocation from `paris/src/index.ts`
5. Drop table:
   - `instance_enforcement_state`
6. Update schema preflight:
   - remove probe for `instance_enforcement_state` if present.

Done criteria (gate):
1. `rg` across repo returns zero runtime references to `instance_enforcement_state`.
2. Free/tier users are never blocked from save/publish by view counts.
3. `/api/usage` no longer writes freeze state or requires freeze reset lifecycle.
4. Table dropped in cloud-dev via migration and schema preflight passes.

Rollback boundary:
- Before table drop: restore freeze runtime behavior from previous commit if required.
- After table drop: forward-only re-create via migration (no reset/rebase workflows).

---

### Phase 6 — Remove dormant render health table and drop `instance_render_health`

Objective:
- Remove unused Supabase render-health storage to eliminate drift and dead operational surface.

Implementation:
1. Remove unused Supabase helpers:
   - `tokyo-worker/src/domains/assets.ts` (`upsertInstanceRenderHealth`, `upsertInstanceRenderHealthBatch`)
   - `paris/src/domains/account-instances/service.ts` (`loadInstanceRenderHealth`)
2. Remove table probes from `paris/src/shared/handlers.ts` if present.
3. Drop table:
   - `instance_render_health`

Done criteria (gate):
1. `rg` across repo returns zero runtime references to `instance_render_health`.
2. Table dropped in cloud-dev via migration and schema preflight passes.
3. Publish/render workflows remain green in cloud-dev Roma/Bob/Venice smoke checks.

Rollback boundary:
- Before table drop: restore helper code from previous commit if required.
- After table drop: forward-only re-create via migration (no reset/rebase workflows).

---

### Phase 7 — Account enrichment: Supabase table -> R2 `profile.json`

Objective:
- Move account enrichment/business profile storage from `account_business_profiles` to R2 account documents.

Storage contract (locked):
1. Single doc key: `account-enrichment/v1/accounts/{accountId}/profile.json`
2. No custom app-level version pointer (`latest.json`) in this phase.
3. No new Supabase columns are required for enrichment pointer/timestamp in this PRD.

Implementation:
1. Add dedicated Paris R2 binding: `ACCOUNT_ENRICHMENT_R2` (`paris/wrangler.toml`, local env, `Env` type).
2. Replace `business-profile-handler` Supabase reads/writes with R2 reads/writes:
   - `GET /api/accounts/:accountId/business-profile` reads `profile.json`.
   - `POST /api/accounts/:accountId/business-profile` writes `profile.json`.
3. Keep San Francisco onboarding persistence contract unchanged (still writes via Paris endpoint), but Paris persists to R2.
4. One-time backfill script:
   - if `account_business_profiles` exists and has rows: read rows and write `profile.json` per account
   - if table is absent or empty: skip backfill
   - emit migrated row counts and run spot checks
5. Update schema preflight in `paris/src/shared/handlers.ts`:
   - remove `account_business_profiles` table probe
6. Drop table:
   - `account_business_profiles`

Done criteria (gate):
1. `rg` across runtime paths shows zero calls to `/rest/v1/account_business_profiles`.
2. Onboarding write path succeeds end-to-end in cloud-dev (San Francisco -> Paris -> R2).
3. Business profile read API returns the expected payload from R2 for cloud-dev test accounts.
4. Backfill counts match and spot checks pass.
5. `account_business_profiles` dropped in cloud-dev migration and schema preflight passes.

Rollback boundary:
- Before table drop: restore Supabase-backed handler.
- After table drop: forward-only table recreation via migration (no reset/rebase workflows).

---

### Phase 8 — Lifecycle notices: remove `account_notices`, use `accounts` lifecycle fields

Objective:
- Remove the premature `account_notices` table and keep current tier-drop notice semantics in `accounts` columns until a real notification service exists.

Storage contract (locked):
1. Current notice semantics are account-scoped state, not a generic notification entity.
2. Add lifecycle columns on `accounts` (locked names):
   - `tier_changed_at`
   - `tier_changed_from`
   - `tier_changed_to`
   - `tier_drop_dismissed_at`
   - `tier_drop_email_sent_at`
3. No separate notices table remains after this phase.

Implementation:
1. Add migration updating `accounts` with lifecycle notice fields and dropping `account_notices`.
2. Paris:
   - remove `createAccountNotice`, list/dismiss helpers, and `/rest/v1/account_notices` usage
   - update plan-change flow (`handleAccountLifecyclePlanChange`) to write lifecycle notice fields on `accounts`
   - replace `/api/accounts/:accountId/notices` + `/notices/:noticeId/dismiss` routes with account-lifecycle notice contract (or remove routes and shift to account-based read path used by Roma)
3. Roma:
   - replace modal data fetch from `/api/paris/accounts/:accountId/notices?status=open`
   - compute/show tier-drop modal from account lifecycle fields returned by bootstrap/account payload
   - dismiss writes account lifecycle dismiss field
4. Paris schema preflight:
   - remove `account_notices` probes if present.

Done criteria (gate):
1. `rg` across runtime paths shows zero calls to `/rest/v1/account_notices`.
2. `account_notices` table is dropped in cloud-dev via migration.
3. Tier-drop modal still works in Roma from account lifecycle fields (open + dismiss path).
4. Plan-change flow still records email-needed/email-sent lifecycle state without `account_notices`.
5. No `/api/accounts/:accountId/notices` dependency remains in Roma/Paris runtime.

Rollback boundary:
- Before table drop: restore existing notice handlers/table usage.
- After table drop: forward-only table recreation via migration (no reset/rebase workflows).

---

## Anti-drift execution rules (mandatory)

1. One phase per PR/merge to keep blast radius controlled.
2. Each phase must include:
   - runtime code cutover
   - migration(s)
   - preflight updates
   - doc updates (`documentation/architecture/CONTEXT.md` as applicable)
3. No hidden dual-source reads after cutover.
4. CI must apply cloud-dev migrations before deploy and fail on schema preflight mismatch.
5. Do not use Supabase reset/rebase workflows for this PRD.

---

## Required doc sync (to avoid truth drift)

When Phase 2 lands:
- Update `documentation/architecture/CONTEXT.md` localization source-of-truth section to reflect R2 overlays.

When Phases 3/4 land:
- Update storage ownership descriptions in architecture docs to reflect asset and l10n state eviction from Supabase.

When Phases 5/6 land:
- Update entitlement/policy architecture docs to remove freeze-by-views behavior and remove render-health Supabase ownership.

When Phase 7 lands:
- Update architecture docs to record account enrichment profile source of truth as R2 `profile.json` per account and remove Supabase table ownership.

When Phase 8 lands:
- Update lifecycle docs to remove `account_notices` table workflow and document account-lifecycle-field contract until full notification service PRD exists.

Doc update is part of definition-of-done for each phase.

---

## Acceptance criteria (full PRD completion)

1. All twelve target tables are removed from Supabase.
2. Runtime code has no references to removed tables/RPCs.
3. Cloud-dev edit/publish/l10n/assets workflows succeed for current active widgets.
4. CI migration + schema preflight gates pass continuously on `main`.
5. Architecture docs match runtime truth on storage ownership.
6. No view-based freeze enforcement path remains in runtime.
7. No runtime dependency on `account_notices` or `/api/accounts/:accountId/notices` remains.

---

## Notes on current baseline (as of 2026-03-04)

1. Cloud-dev migration drift was present and has been corrected; migration discipline and schema preflight were added to CI.
2. Paris currently still probes overlay/l10n/assets tables in schema health; probes must be updated phase-by-phase as cutover removes tables.
3. Freeze-by-views enforcement is currently live in Paris/Bob and must be removed in Phase 5 to align with the financial constraint.
4. Account enrichment currently persists through Supabase `account_business_profiles` and must move to R2 in Phase 7.
5. Lifecycle tier-drop notice flow currently depends on `account_notices` and must collapse into `accounts` lifecycle fields in Phase 8.
6. This PRD now serves as the execution contract; implementation starts from this locked sequence.
