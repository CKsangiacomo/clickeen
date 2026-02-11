# V0 Localization Agent Execution Plan

Status: Superseded. This plan reflects the old manifest-based pipeline and is no longer active.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

Status: Executing (local stack stabilized; migration applied). Cloud-dev deploy pending.

## Goal
Deliver localization as a deterministic, budgeted, overlay-based system that scales across widgets and tiers without mutating canonical configs.

## Scope (V0)
- San Francisco agent generates locale overlays (ops) for curated and entitled user instances.
- Paris triggers localization jobs on publish/update.
- Venice applies overlays at render time.
- Tokyo stores overlays + manifest using the existing l10n format.
- Bob/Paris enforce entitlements + subject policy + workspace locale selection.

## Core Decisions (Resolved)
- **Instance model:** `curated` vs `user` only. Curated instances serve both Prague creatives and template pickers.
- **Localization is overlays:** Never mutate canonical configs. Missing/invalid overlay falls back to base.
- **Entitlement key:** `l10n.enabled` (boolean) + `l10n.locales.max` (number or null).
- **Tier cap:** Tier 2 = 3 locales, Tier 3 = unlimited, Free/Tier1/Minibob = no localization. DevStudio = uncapped.
- **Locales source:** single canonical `config/locales.json`.
- **Trigger policy:** publish/update only. No nightly refresh.
- **Allowlist location:** `tokyo/widgets/{widgetType}/localization.json` (typed entries).
- **baseUpdatedAt:** use `widget_instances.updated_at` as the correctness stamp.
- **Queue:** Cloudflare Queues (Paris → SF queue handler).
- **No new worker:** add a queue consumer handler to the existing San Francisco worker.

## Contract Summary
- **Effective gating:** `entitlements` ∩ `subject policy` ∩ `workspace.l10n_locales`.
- **Ops shape:** set-only ops; paths must be allowlisted; values validated by type.
- **Fail-safe:** overlay missing/mismatch → render base config; never crash or silently mutate.
- **Idempotency:** job key `(publicId, baseUpdatedAt, locale)`; skip if overlay exists for same key.

## Progress (Local)
- [x] Migration applied: `supabase/migrations/20260112090000__l10n_locales.sql` (local).
- [x] Local stack restarted via `scripts/dev-up.sh` (Tokyo/Paris/SF/Venice/Bob/DevStudio/Prague).
- [x] Paris endpoints + queue binding in place.
- [x] SF l10n agent + queue consumer in place.
- [x] Tokyo l10n write path in place.
- [x] Venice overlay apply path in place.
- [x] Docs updated (localization + multitenancy + paris/tokyo/venice/michael).
- [ ] Subject policy gating wired (ck-policy + Bob UI).
- [ ] Tests + end-to-end validation (publish → queue → overlay → render).
- [ ] Cloud-dev wiring + deploy (env vars, queues, workers).

## Phase 1 — Config + Policy + Allowlists
1) **Entitlements matrix**
   - Add `l10n.enabled` and `l10n.locales.max` in `config/entitlements.matrix.json`.
   - Enforce Tier 2 = 3, Tier 3 = null (unlimited).
2) **Subject policy (product-owned)**
   - Add `l10n` gating in `tooling/ck-policy` for relevant subjects (minibob, devstudio, workspace).
   - Bob uses subject policy to show/hide locale picker.
3) **Widget allowlists**
   - Add `tokyo/widgets/faq/localization.json`.
   - Add `tokyo/widgets/logoshowcase/localization.json`.
   - Typed schema (example):
     - `string`, `richtext`, `array[string]`, `array[richtext]`.

## Phase 2 — Database Schema (Michael)
1) Add `widget_instances.kind` enum: `curated | user`.
2) Add `workspaces.l10n_locales` JSONB array (selected locales).
3) Ensure `widget_instances.updated_at` updates on any config change.

## Phase 3 — Paris (Trigger + API)
1) **Workspace locale endpoints**
   - `GET /api/workspaces/:id/locales` (owner-only).
   - `PUT /api/workspaces/:id/locales` (entitlement gated).
2) **Trigger logic**
   - On publish/update:
     - If `kind=curated`: target all locales from `config/locales.json`.
     - If `kind=user`: target `workspaces.l10n_locales` up to cap.
3) **Queue binding**
   - Add `L10N_QUEUE` binding in `paris/wrangler.toml`.
   - Enqueue jobs: `{ publicId, widgetType, baseUpdatedAt, kind, workspaceId, locales }`.

## Phase 4 — San Francisco (Agent)
1) Add queue handler to existing SF worker.
2) Implement `l10n.instance.v1` agent:
   - Fetch allowlist from Tokyo; cache in KV (TTL 1h).
   - Build prompt with allowlist + base config + locale.
   - Enforce budgets: tokens, timeout, maxCostUsd, maxRequests.
   - Validate ops (set-only, allowlisted paths, typed values).
   - Emit logs: `promptVersion`, `policyVersion`, `locale`, `opsCount`, `cost`, `latency`.
3) Idempotency:
   - If overlay exists for `(publicId, baseUpdatedAt, locale)`, skip.

## Phase 5 — Tokyo (Overlay Write)
1) Implement write path in Tokyo worker:
   - Store overlay at `tokyo/l10n/instances/{publicId}/{locale}.{hash}.ops.json`.
   - Update `tokyo/l10n/instances/{publicId}/manifest.json`.
2) Hash logic must match `scripts/l10n/build.mjs` for consistency.

## Phase 6 — Venice (Overlay Apply)
1) Fetch manifest + overlay at render time.
2) Validate `baseUpdatedAt` match; if mismatch, skip overlay.
3) Apply set-only ops via path setter.
4) Inject localized config into widget runtime.

## Phase 7 — Testing + Docs
1) Tests:
   - Allowlist validation
   - Entitlement enforcement
   - Overlay apply
   - Publish → queue → overlay → render integration
2) Docs:
   - Update `documentation/capabilities/localization.md`
   - Update `documentation/capabilities/multitenancy.md`
   - Update `documentation/services/paris.md`
   - Update `documentation/services/sanfrancisco.md`
   - Update `documentation/services/venice.md`

## Acceptance Criteria (V0)
- Curated instances render localized overlays for all supported locales in Prague.
- User instances localize only if entitled and selected.
- No canonical config mutations; overlays only.
- All LLM calls go through San Francisco with enforced budgets.
- Fail-safe rendering when overlays are missing or stale.

## Risks & Mitigations
- **Cost spikes:** enforce queue limits + budgets per job.
- **Drift:** single locales list and shared overlay format.
- **Stale overlays:** baseUpdatedAt checks + idempotency keys.
