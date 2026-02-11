# Open PRDs Execution Ledger (07-14)

Status: Superseded. Historical execution record only.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

Historical execution record: Phases 0-4 complete; Phase 5 pending verification.
Owner: Product Dev Team
Environment: Local-first, then cloud-dev validation
Scope: PRD 07-14 (historical docs now live across `Execution_Pipeline_Docs/00-Strategy/` and `Execution_Pipeline_Docs/03-Executed/`).

This doc is the execution ground truth for the open PRDs. It is intentionally detailed so we can resume after context loss.

---

## 0) Locked decisions (do not relitigate unless explicitly changed)
- Localization addressing: Option A (deterministic `baseFingerprint` key, no manifest).
- Tier naming: `free`, `tier1`, `tier2`, `tier3` (no `pro/enterprise` rename).
- PRD 10 scope now: limits + cleanup only (no rollback UI/API yet).
- Asset upload versioning: out of scope (l10n overlay versioning only).
- Personalization preview: async job with polling (no blocking UX).
- AI registry: lives in `@clickeen/ck-policy` (no parallel registry package).

## 1) PRDs in scope (by file)
- 07_PRD_Multitenancy_and_SubjectPolicy_System.md
- 08_PRD_System_User_Instance_Split.md
- 09_PRD_Prague_Blocks_Components_Refactor.md
- 10_PRD_Version_Limits_Assets_Localization.md
- 11_AGENTS_UPLEVEL_PLAN.md
- 12_PRD_PERSONALIZATION_AGENTS_PRD.md
- 13_SF_AGENTS_UPLEVEL_PLAN_ADDENDUM_Personalization.md
- 14_Localization_Architecture_Update.md

## 2) Current runtime anchors (reality checks)
- Policy engine lives in `tooling/ck-policy` and is consumed by Bob + Paris.
- Entitlements matrix is `config/entitlements.matrix.json`.
- Curated vs user instances are split (`curated_widget_instances` + `widget_instances` constraints).
- L10n overlays are deterministic keys: `l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`.
- Prague block registry + JSON composition exist in `prague/src/lib/`.

---

## 3) Execution phases

### Phase 0: Close PRD 07/08/09 deltas and align naming
Goal: Remove drift so later phases land cleanly.

Tasks
- Policy keys:
  - Align capability names (eg `seoGeo.enabled` vs `embed.seoGeo.enabled`).
  - Expand action keys to cover PRD 07 minimum actions.
  - Ensure `@clickeen/ck-policy` exports typed keys that match the matrix.
- Curated write hardening:
  - Enforce local-only curated writes (cloud-dev read-only for curated).
  - Keep curated instance prefix routing strict.
- Prague refactor cleanup:
  - Remove remaining page-family block folders or rename into type-based blocks.
  - Ensure all blocks referenced in `tokyo/widgets/*/pages/*.json` are in registry.
- Documentation updates:
  - Update `documentation/services/paris.md`, `documentation/services/prague/prague-overview.md` if behavior shifts.

Status notes (complete)
- Curated writes are now local-only in Paris (cloud-dev read-only).
- Policy registry keys are now typed and validated against `config/entitlements.matrix.json`.
- Prague legacy block folders removed (page-family placeholders cleaned).

Acceptance checks
- Bob still loads and publishes via the 2-call pattern.
- Prague builds without block validation errors.
- Curated writes are blocked outside local.

---

### Phase 1: PRD 14 Localization architecture hardening
Goal: Queue-only publishing with dirty-set tracking, no global manifest.

Tasks
- Add a new table for l10n publish state (separate from `widget_instance_locales`).
  - Fields: `public_id`, `locale`, `base_fingerprint`, `published_fingerprint`, `publish_state`, `publish_attempts`, `publish_next_at`, `last_error`, `updated_at`.
- Paris:
  - On l10n upsert/delete, mark state dirty and enqueue publish job with fingerprint.
- Tokyo-worker:
  - Consume queue jobs only; publish deterministic overlay key and mark state clean.
  - Replace scheduled republish with a dirty-only repair job (bounded, indexed).
- Venice:
  - Use cached fetch for immutable overlay files; no manifest lookups.
- Docs:
  - Remove manifest references from `documentation/services/tokyo.md` and `documentation/services/venice.md`.

Status notes (complete)
- `l10n_publish_state` + dirty-set queue flow live in Paris + Tokyo-worker.
- Scheduled repair uses dirty rows only (no full republish).
- Venice fetches deterministic overlay files directly (no manifest lookup).

Acceptance checks
- No full-table scans or daily republish of all locales.
- Publishing uses deterministic key and is idempotent.
- Missing overlay behavior remains fail-fast for curated in dev.

---

### Phase 2: PRD 10 Version limits + cleanup (no rollback UI)
Goal: Enforce l10n overlay version caps per tier.

Tasks
- Schema:
  - `l10n_overlay_versions` table + RLS (version ledger).
- Tokyo-worker:
  - Record overlay versions on publish and prune older fingerprints per tier.
- Entitlements:
  - Add l10n overlay version cap values per tier (free=1, tier1=3, tier2/3=10).
- Update PRD 10 language to match deterministic overlay keys (no manifest updates).

Status notes (complete)
- `l10n_overlay_versions` ledger + pruning live in Tokyo-worker.
- Tier caps set via `l10n.versions.max` in entitlements matrix.

Acceptance checks
- Version counts never exceed cap per tier.
- R2 files match DB version counts.

---

### Phase 3: PRD 11/13 AI foundation (policy-driven intelligence)
Goal: Single registry, policy capsule in grants, shared router.

Tasks
- Registry:
  - Add AI agent registry inside `@clickeen/ck-policy` and export typed unions.
  - Canonicalize `cs.copilot.v1` with alias `sdr.widget.copilot.v1`.
- Paris:
  - Validate agentId against registry, mint grants with `ai` policy capsule + canonical agent cap.
- San Francisco:
  - Registry-based dispatch instead of hard-coded switches.
  - Model router + provider clients + single call path.
- Bob:
  - Fix `trace.client` for bob vs minibob; pass `subject` + `workspaceId` to grants.

Status notes (complete)
- Registry + grant capsule wired in `@clickeen/ck-policy` and `paris`.
- SF dispatch uses canonical IDs; `sdr.copilot`, `cs.copilot.v1`, `editor.faq.answer.v1` now call `callChatCompletion`.
- SF interaction logs include `aiProfile` + `taskClass` for analytics.
- `l10nInstance` still uses direct provider calls (no grant); revisit if service grants are added.
- Bob copilot trace client now distinguishes `minibob` vs `bob`.

Acceptance checks
- Grants are policy-driven, not hard-coded.
- Existing agents work through router with identical outputs.
- SF logs include profile/provider/model/taskClass.

---

### Phase 4: PRD 12 Personalization agents
Goal: Launch preview first, onboarding second.

Tasks
- Preview (Prague):
  - `POST /api/personalization/preview` → returns jobId.
  - Prague polls and applies `copyOverrides` to in-memory instance.
  - Safe web fetch tools with strict SSRF protections.
- Onboarding (Bob):
  - Create `workspace_business_profiles` table in Supabase.
  - `POST /api/personalization/onboarding` → job → SF → write profile.
  - Bob reads profile to prefill onboarding and suggest templates.
- Entitlements:
  - Add personalization capability keys to policy.

Acceptance checks
- Preview flow does not block UI and degrades gracefully on failure.
- Onboarding personalization respects tier gates.
- No new copilot surfaces are introduced (agents only).

Status notes (complete)
- Preview backend wired: Paris issues grants and proxies SF job creation/status.
- SF preview job stores status in KV and uses safe-fetch + policy-routed model calls.
- Onboarding backend wired: SF job runner persists `workspace_business_profiles` via Paris, Paris exposes onboarding endpoints + business profile API.
- Bob proxy routes added for onboarding create/status and business-profile fetch (used by Settings panel).
- Bob Settings panel now triggers onboarding personalization, polls job status, and shows stored business profile.
- Prague preview UI now includes a personalization modal (hero), calls Paris preview endpoint, and applies copy overrides via `data-ck-copy` hooks.

---

### Phase 5: Hardening and release
Goal: Ensure determinism and no drift.

Tasks
- Run compile gate: `node scripts/compile-all-widgets.mjs`.
- Lint/typecheck/test per package.
- Verify cloud-dev flows: curated publish, Venice overlay resolution, AI grant+execute, Prague personalization preview.
- Update docs to match runtime truth.

Status notes (pending)
- Verification steps are intentionally skipped for now (per request).
- DevStudio tests now cover curated instance empty state + creation flow.

Acceptance checks
- No doc drift for PRD 07-14.
- No production secrets in docs or front-end.

---

### Phase 6: Prague Babel alignment (tokenized base + ops overlays)
Goal: Replace `prague-strings/**` with a tokenized base+ops system aligned to Babel.

Tasks
- Define Prague content contract:
  - Create base content files: `prague/content/base/v1/{surface}/{page}.json`.
  - Shape: `{ v: 1, pageId, blocks: { [blockId]: { copy: {...} } }, meta?: {...} }`.
  - Token keys are `pageId.blockId.copyPath` (stable, locale-free).
  - Add allowlist files: `prague/content/allowlists/v1/{surface}/{page}.json` with typed paths (`string` | `richtext`).
- Deterministic overlay addressing:
  - Compute `baseFingerprint` from base JSON using `@clickeen/l10n`.
  - Overlay path: `tokyo/l10n/prague/{pageId}/{locale}/{baseFingerprint}.ops.json` (no manifest).
  - Store `baseFingerprint` in base file metadata or compute at load time.
- Publishing pipeline:
  - Replace `scripts/prague-strings/*` with `scripts/prague-l10n/*` (ops-first).
  - Use SF `/v1/l10n/translate` to generate ops against allowlists.
  - Publish overlays via Tokyo worker (immutable cache), keyed by `baseFingerprint`.
  - Remove `sanfrancisco/src/agents/l10nPragueStrings.ts` and any Prague-strings job plumbing.
- Runtime integration:
  - Replace `prague/src/lib/pragueStrings.ts` with `prague/src/lib/pragueL10n.ts`.
  - Load base content, compute fingerprint, fetch overlay from Tokyo, apply ops, and hydrate block copy.
  - Replace `prague/src/lib/i18n.ts` chrome strings to use the same base+ops model (no separate pipeline).
  - Update `prague/src/lib/markdown.ts` to use the new loader; keep `blockRegistry` validation strict.
  - Update `prague/package.json` build step to remove compile step.
- Contract enforcement + tests:
  - Add a verification script `scripts/prague-l10n/verify.mjs`:
    - Ensures every page block has required copy keys.
    - Ensures overlay ops paths are allowlisted and set-only.
    - Ensures overlay fetch path == publish path (`baseFingerprint` match).
  - Wire verification into `pnpm build:prague` (fail-fast).
- Docs:
  - Update `documentation/architecture/CONTEXT.md` to remove `prague-strings` mention.
  - Update Prague service docs to reflect base+ops overlays and Tokyo fetch path.

Status notes (complete)
- Migrated base content into `prague/content/base/v1/**` and allowlists into `prague/content/allowlists/v1/**`.
- Generated deterministic overlays under `tokyo/l10n/prague/**` with `baseFingerprint` keys.
- Prague runtime now loads base + Tokyo overlays; `prague-strings/**` pipeline removed.
- Added `scripts/prague-l10n/verify.mjs` and wired it into Prague build/dev-up.

Acceptance checks
- Prague pages render with localized copy from ops overlays (no compiled strings).
- No references to `prague-strings/**` or l10n manifest remain.
- Overlay files are content-addressed and cached immutably.
- Block contracts fail fast on missing copy keys or invalid ops paths.

---

## 4) Resume checklist (if context is lost)
1) Confirm locked decisions in section 0.
2) Check latest migrations in `supabase/migrations` for new tables.
3) Scan `paris/src/index.ts` for l10n publish flow changes.
4) Scan `tokyo-worker/src/index.ts` for scheduled republish and publish path logic.
5) Validate `config/entitlements.matrix.json` matches `@clickeen/ck-policy` keys.
6) Verify Prague block registry and page JSON consistency.

---

## 5) Risks and mitigations
- Risk: naming drift across policy keys.
  - Mitigation: single source of truth in `@clickeen/ck-policy` + matrix.
- Risk: localization publish backlog or queue failures.
  - Mitigation: dirty-set repair job with bounded query.
- Risk: AI registry divergence.
  - Mitigation: registry lives in code with typed exports.
- Risk: asset version rotation breaks URLs.
  - Mitigation: latest asset path remains stable; only older versions are rotated.

## 5.1) Local dev stabilization notes (2026-01-20)
- Added `env.local` R2 binding in `tokyo-worker/wrangler.toml` to satisfy local worker expectations.
- Fixed SanFrancisco personalization status route regex parsing.
- Fixed Prague personalization preview script binding (no inline TS) and set `PUBLIC_PARIS_URL` in local env.
- Removed inline TS annotation in Prague curated embed script.
- Escaped quote string in Bob localization notice to satisfy lint.
- Applied local Supabase migration for `workspace_business_profiles` (no resets).

---

## 6) Files and paths (quick reference)
- Policy: `tooling/ck-policy/src/*`, `config/entitlements.matrix.json`
- Paris: `paris/src/index.ts`
- San Francisco: `sanfrancisco/src/index.ts`
- Tokyo-worker: `tokyo-worker/src/index.ts`
- Venice: `venice/lib/l10n.ts`, `venice/lib/tokyo.ts`
- Prague: `prague/src/lib/blockRegistry.ts`, `prague/src/lib/markdown.ts`
- Migrations: `supabase/migrations/*`
