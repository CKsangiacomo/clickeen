# 16 - Blueprint Layers + Personalization + Playbooks Execution Plan

Status: Draft for peer review
Environment: local repo only (no cloud-dev writes; no Supabase resets; migrations run only against local Supabase)

Goal
Ship the Blueprint primitives as real, enforceable system behavior:
- Multi-layer variants (base + deterministic layers) for widgets and Prague.
- Personalization as a real overlay layer (not DOM hacks).
- Playbooks as versioned runtime contracts (lightweight metadata now, enforcement later).

Non-goals (out of scope for this plan)
- UI i18n catalogs (tokyo/i18n) changes.
- Asset upload versioning.
- New widgets or new block types.
- Backward compatibility shims (pre-GA; fail fast instead).

Guiding principles (from Blueprint + Vision)
- Legible state: structured base + typed ops only.
- Safe actions: allowlisted paths; no side effects; fail-fast on invalid ops.
- Deterministic layering: ordered, composable ops on top of base.
- Edge delivery: immutable overlays fetched by deterministic keys.
- Governance: budgets, policy, playbook versions, audits.

Decision gates (locked for execution)
1) Layer order (canonical, from BabelProtocol): base -> locale -> geo -> industry -> experiment -> account -> behavior -> user (user_ops last).
2) LayerKey contract + canonicalization functions per layer (locale BCP47, geo ISO, etc).
3) Layer selection contract: locale/geo/industry/account = 0 or 1 key; experiment/behavior = multi-key, deterministic ordering.
4) User override keying: layer=user with layerKey=<locale>, optional layerKey=global fallback.
5) Geo semantics: geoTargets only drive locale selection; geo layer handles geo-specific overrides.
6) Index.json semantics (hybrid): keys list + optional lastPublishedFingerprint per key.
7) Index runtime algorithm: never apply stale overlays; lastPublishedFingerprint is diagnostic only.
8) DB retention: widget_instance_overlays stores latest per (publicId, layer, layerKey); history lives in R2 + ledger.
9) Overlay addressing:
   - Instances: tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json
   - Prague:    tokyo/l10n/prague/<pageId>/<layer>/<layerKey>/<baseFingerprint>.ops.json
10) Composition point: Venice/Prague compose layers at edge (not precomposed).
11) Preview model: choose Option A (ephemeral DOM/in-memory + Apply) or Option B (overlay preview with TTL + signed token) before Phase 3.
12) Playbooks: registry-driven playbookId+version; Phase 4 metadata only; Phase 5 enforcement.
13) Paris auth: dev/local uses PARIS_DEV_JWT; prod uses Supabase Auth JWT + workspace membership checks.
14) Feature flags + rollback per phase (pre-GA, short-lived).

Current baseline (already in repo)
- Base + ops localization for instances: widget_instance_locales -> tokyo-worker -> tokyo/l10n/instances/<publicId>/<locale>/<fingerprint>.ops.json.
- Prague base + ops localization: prague/content/base/v1 + tokyo/l10n/prague/<pageId>/<locale>/<fingerprint>.ops.json.
- Venice + Prague runtime apply locale overlays only.
- Personalization preview is DOM-only (no overlay layer).
- Playbooks are docs, not enforceable runtime contracts.

Target architecture (end state)
- A single, layered overlay model for both instances and Prague.
- Deterministic overlay addressing per layer + baseFingerprint.
- Index.json per publicId/pageId declaring available layers + keys (hybrid with lastPublishedFingerprint).
- Edge runtime composes layers in strict order; user overrides last.
- Playbooks resolved by registry; enforcement comes after metadata adoption.

Workstream A: Layered variants (instances + Prague)

A0) Layer contract + LayerKey + index semantics + allowlists
What
- Define LAYER_ORDER constant (code + docs).
- Define LayerKey contract per layer and canonicalization functions:
  - locale: BCP47 (en, fr-CA)
  - geo: ISO-3166 (US, DE) or explicit market groupings
  - industry: slug enum (dentist, restaurant)
  - experiment: exp_<id>:<variant>
  - account: stable account token (not raw domain)
  - behavior: behavior_<id>
  - user: user (single) or usr_<id> if explicitly needed
  - preview: opaque, unguessable token (job-based)
- Define layer selection contract (0/1 vs multi-key):
  - locale/geo/industry/account: 0 or 1 key chosen deterministically from request context
  - experiment: list of keys sorted by expId (deterministic)
  - behavior: list of keys sorted deterministically
  - user: per-locale key first, then global fallback (if enabled)
- User override keying model:
  - layer=user, layerKey=<locale> with optional layerKey=global fallback.
- GeoTargets semantics:
  - geoTargets only used for locale selection (never for geo overrides).
- Define Layered Overlay schema (v, baseFingerprint, ops[] set-only, metadata).
- Define index.json schema (layers list, keys per layer, optional lastPublishedFingerprint per key, optional geoTargets for locale selection).
- Define index runtime algorithm:
  - lastPublishedFingerprint is diagnostic only; never apply overlay if baseFingerprint mismatches.
- Define allowlist resolution per layer:
  - locale layer uses tokyo/widgets/<widget>/localization.json
  - other layers can override via tokyo/widgets/<widget>/layers/<layer>.allowlist.json
Why
- Prevent path drift, normalize semantics, and keep ops safe across layers.
How
- Add schemas (config/overlay.schema.json, config/index.schema.json).
- Add normalization helpers (shared package or copied into Paris/Tokyo-worker/Venice).
- Update documentation/capabilities/localization.md + BabelProtocol with the canonical order + LayerKey examples.
- Add contract tests in scripts/verify-contracts.mjs (layer order, paths, schema tokens).

A1) Data model: unify overlay storage for instances
What
- Add widget_instance_overlays (layer, layer_key, ops, user_ops, base_fingerprint, base_updated_at, source, geo_targets, workspace_id, updated_at).
Why
- Single source of truth for layered variants, not locale-only.
How
- Migration: create widget_instance_overlays with RLS rules mirroring widget_instance_locales.
- Backfill: copy widget_instance_locales rows to layer=locale, layer_key=<locale>.
- Backfill validation: recompute baseFingerprint; log stale overlays (do not block migration).
- Keep widget_instance_locales read-only during migration window; remove only after rollback window ends.
- Add composite indexes: (public_id, layer, layer_key), (workspace_id), (layer, layer_key, base_fingerprint).
- DB retention decision: enforce uniqueness on (public_id, layer, layer_key); keep only latest in DB.
- History lives in R2 + version ledger.
Notes
- No destructive resets. This is additive + backfill only.
- Human-only instance edits remain enforced (DevStudio).

A2) Paris API: layered overlay endpoints
A2a) Design (review with architect before coding)
- Workspace-scoped endpoints:
  - GET /api/workspaces/:workspaceId/instances/:publicId/layers
  - GET /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey
  - PUT /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey
  - DELETE /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey
- Request/response schema:
  - PUT: { ops?, userOps?, baseFingerprint?, source?, geoTargets? }
  - GET: { ops, userOps, baseFingerprint, baseUpdatedAt, source, geoTargets }
- Entitlements:
  - locale: tier-based limits (l10n.locales.max)
  - geo/industry/experiment/account/behavior: tier-gated flags/caps (to define)
- Rate limits: read/write caps per workspace (exact numbers in policy)
- Errors: 400 invalid ops, 403 entitlement, 404 missing layer, 409 fingerprint mismatch
- Authentication:
  - Dev/local: PARIS_DEV_JWT
  - Production: Supabase Auth JWT + workspace membership checks
  - RLS enforces workspace_id at DB layer
A2b) Implementation
- Implement routing + validation + allowlist enforcement.
- Preserve user_ops semantics (stored separately; merged at publish).
- Enqueue publish job per layer write (tokyo-worker).
A2c) Tests
- Unit tests for validation + entitlement enforcement.
- Integration tests for read/write + publish queue.

A3) Tokyo-worker publishing: materialize layered overlays
What
- Publish each layer to deterministic paths and record versions for cleanup.
Why
- Edge delivery must be immutable and layer-addressable.
How
- Read widget_instance_overlays by layer + layer_key.
- Merge ops + user_ops (user_ops last) for layer=user only.
- Write tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json.
- Write index.json with keys + lastPublishedFingerprint per key (hybrid).
- Apply geoTargets only to locale layer entries.
- Publish ordering: write overlay artifacts first, then update index.json.
A3b) Overlay version cleanup
- Extend version ledger to include layer + layer_key.
- Keep latest N versions per layer (configurable by tier).
- Use lifecycle rules for R2 cleanup (older than X days).
- Never auto-delete curated overlays without explicit human action.

A4) Prague overlays: layered paths + index
What
- Prague overlays follow the same layered path + index pattern.
Why
- Consistency across product and marketing surfaces.
How
- Update scripts/prague-l10n to emit layered overlays under tokyo/l10n/prague/<pageId>/<layer>/<layerKey>/<fingerprint>.ops.json.
- Update prague-l10n verify to check layer order, LayerKey canonicalization, index.json semantics.

A5) Venice + Prague runtime composition
What
- Fetch index.json, resolve available layer keys, and apply overlays in order.
Why
- Deterministic layering is the runtime truth.
How
- Venice: extend venice/lib/l10n.ts to apply layers in order (parallel fetch, short-circuit on missing).
- Prague: extend prague/src/lib/pragueL10n.ts similarly.
- Guardrails:
  - Parallel fetch overlays (Promise.all)
  - Hard cap on applied layers (configurable, default 6-8)
  - Skip missing layers unless curated/dev mode requires them
  - Cache index.json with short TTL; overlays immutable long TTL
- Composition timeout budget: total 100ms, per-layer fetch 20ms (skip on timeout, log warning).
- Geo targeting: either implement end-to-end or remove from index schema to avoid ghost features.

Workstream B: Personalization as overlay layer

B0) Decide preview model (required before Phase 3)
Option A: Ephemeral DOM/in-memory preview (simpler)
- Preview data returned from personalization agent.
- UI applies preview in memory.
- Apply persists to layer=user/account via Paris.
Option B: Preview overlay (uniform with layers)
- Preview overlays stored in R2 under preview layer + token.
- TTL enforced via R2 lifecycle or KV with TTL.
- Preview tokens are unguessable and scoped (workspace + instance + expiry).
Decision: choose A or B before Phase 3; document lifecycle and security.

B1) Preview infrastructure (Option B only)
What
- Add tokyo-worker endpoint to write preview overlays (private, signed).
- Store preview overlays under:
  tokyo/l10n/instances/<publicId>/preview/<token>/<baseFingerprint>.ops.json
Why
- Keep preview consistent with runtime layering and debugging.
How
- Enforce TTL via R2 lifecycle (preview prefix) or KV TTL if stored outside R2.
- Preview token format: signed JWT containing { workspaceId, publicId, jobId, exp }.
- Venice validates preview token signature before fetching.
- Error handling: expired token -> 401; missing overlay -> 404 fallback to base.

B2) Apply flow (A or B)
What
- Explicit "Apply" persists preview to layer=user or layer=account.
Why
- User intent must be explicit; preview must not pollute truth.
How
- Paris writes to widget_instance_overlays and enqueues publish.
- UI shows confirmation and refreshes preview state.

B3) Runtime integration
What
- Venice respects preview token (query param) and composes preview layer on top.
- Prague preview UI passes preview token when rendering.
Why
- Preview must reflect actual runtime layering.
How
- Ensure preview overlays are cached with short TTL or no-store.

Workstream C: Playbooks (metadata now, enforcement later)

C0) Metadata-only (Phase 4 optional)
What
- Add playbookId + version to registry entries (server-owned).
- SF resolves playbookId/version from registry, not from client request.
- Emit playbookId+version in usage events/outcomes.
Why
- Introduce governance metadata without blocking runtime.
How
- Extend registry schema and logging; add light tests for presence.

C1) Enforcement (Phase 5 future)
What
- Add playbook spec files + schema validation + enforcement in /v1/execute.
Why
- Enforce deterministic contracts once agent surfaces mature.
How
- Require 3-5 stable agents before enforcement goes live.

Phasing and checkpoints

Phase 0: Specification + contract alignment
- Document layer order (BabelProtocol alignment).
- Document LayerKey contract + canonicalization functions.
- Document layer selection contract (0/1 vs multi-key) + deterministic ordering rules.
- Document user override keying model (per-locale + global fallback).
- Document geoTargets semantics (locale selection only).
- Document index.json semantics (hybrid with lastPublishedFingerprint).
- Document index runtime algorithm (never apply stale overlays).
- Document DB retention/uniqueness model for widget_instance_overlays.
- Document Paris auth mechanism (dev vs prod).
- Define allowlist resolution per layer.
- Update docs: BabelProtocol, localization.md, SF overview.
Gate: docs updated + decisions recorded.

Phase 0.5: Testing infrastructure (before data migration)
- Contract tests: overlay schema, index schema, layer order, path builders.
- Integration tests: Paris write -> tokyo-worker publish -> Tokyo fetch -> Venice compose.
- Edge cases: fingerprint mismatch, missing overlays, corrupt index.json.
- Performance smoke: compose 6-8 layers under target (local benchmark).
- Canonicalization tests: fr_FR -> fr-FR, etc.
- Multi-key ordering tests: experiments/behavior deterministic ordering.
- Publish ordering test: overlay exists before index.json points to it.
Gate: tests green in CI/local.

Phase 1: Instance layered storage + Paris API + publishing
- Add widget_instance_overlays migration + backfill script (local only).
- Implement Paris layered endpoints + tests + entitlement checks.
- Update tokyo-worker publish + index.json hybrid logic.
- Add feature flag: USE_LAYERED_OVERLAYS (default false outside local).
Gate: local l10n build + publish works for locale layer; flag-controlled rollout.

Phase 2: Prague layered overlays
- Update prague-l10n scripts to emit layered paths + index.json.
- Update Prague runtime loader to apply layers in order.
- Add canary rollout plan (prague-dev first).
Gate: prague-l10n verify passes; Prague pages render in locales.

Phase 3: Personalization preview
- Implement chosen preview model (A or B).
- Update Prague preview UI + Venice preview param handling.
- Implement Apply flow to persist to user/account layer.
- Add feature flag: PREVIEW_AS_OVERLAY (only for Option B).
Gate: preview works end-to-end; Apply persists only on explicit user action.

Phase 4: Playbook metadata (optional)
- Add playbookId+version to registry and SF logging.
Gate: metadata emitted; no enforcement.

Phase 5: Playbook enforcement (future)
- Add playbook specs + schema validation + enforcement.
Gate: multiple agents proven stable.

Rollback and rollout (per phase)
- Phase 1: USE_LAYERED_OVERLAYS flag; dual-read to old table; do not drop widget_instance_locales until stable window ends.
- Phase 2: keep legacy Prague scripts in a branch; canary deploy before full rollout.
- Phase 3: PREVIEW_AS_OVERLAY flag; fallback to DOM preview (Option A) if flag off.
- Phase 4: ENFORCE_PLAYBOOKS flag (default false); warning-only until enabled.
- Clarification: no public runtime shims; internal migration safety (dual-read) is allowed pre-GA.

Implementation details (what/why/how)

Layer indexing
- What: index.json per publicId/pageId listing layers + keys + optional lastPublishedFingerprint per key.
- Why: Avoid global manifests and reduce 404 misses after base changes.
- How: tokyo-worker writes index.json at publish; Prague scripts generate index.json at build.

Allowlists
- What: allowlists per layer (locale default; overrideable per layer).
- Why: experiments/industry often need different paths than locale.
- How: resolve allowlist per layer; fall back to localization.json when no override exists.

Overlay size limits
- Max ops per overlay: 1000
- Max op value size: 100KB
- Max overlay payload: 1MB
- Reject with 413 Payload Too Large

Ops merging
- What: user overrides always apply last (layer=user or user_ops merged last).
- Why: user intent must win deterministically.
- How: apply overlay order + merge ops in tokyo-worker for user layer only.

Caching + fanout
- What: immutable overlays cache at edge; index.json short TTL; preview short TTL.
- Why: high scale; preview should not be cached globally.
- How: set Cache-Control by path/layer; contract tests to block no-store on immutable paths.
- Guardrail: cap layer fanout and fetch in parallel.

Preview security (Option B)
- Preview tokens must be unguessable and scoped (workspace + instance + expiry).
- TTL enforced by R2 lifecycle or KV TTL.
- Venice must validate token before fetch.

Data retention
- Keep latest N overlay versions per layer (tier-configurable).
- Use lifecycle rules to delete older R2 overlays.

Risks + mitigations
- Risk: layer order drift across docs/code.
  - Mitigation: single LAYER_ORDER constant + contract tests + doc alignment.
- Risk: index.json drift or stale fingerprints.
  - Mitigation: hybrid index with lastPublishedFingerprint + fallback to baseFingerprint.
- Risk: preview layer pollutes truth.
  - Mitigation: preview stored outside DB; Apply required to persist.
- Risk: playbook spec drift.
  - Mitigation: metadata only first; enforcement later.

Human-only actions (explicit)
- Instance creation/edits remain human-only in DevStudio.
- Supabase migrations executed only by humans, only on local Supabase.

Testing + verification (local)
- scripts/verify-contracts.mjs (expanded for layer order + path schemas).
- scripts/prague-l10n/verify.mjs.
- scripts/l10n/build.mjs.
- Integration tests for overlay pipeline (Paris -> tokyo-worker -> Venice).
- pnpm -w build.

Deliverables checklist
- [ ] Layer order aligned with BabelProtocol (docs + code constant).
- [ ] LayerKey contract + canonicalization functions.
- [ ] Layer selection contract + deterministic ordering rules.
- [ ] User override keying model defined (per-locale + global fallback or alternative).
- [ ] GeoTargets semantics decided (locale selection only or removed).
- [ ] Index runtime algorithm documented (never apply stale overlays).
- [ ] Overlay + index schema added with tests.
- [ ] widget_instance_overlays table + backfill script.
- [ ] Backfill validation logs stale overlays.
- [ ] widget_instance_overlays uniqueness + retention decision implemented.
- [ ] Paris layered overlay API design + implementation + tests.
- [ ] Paris auth mechanism documented (dev + prod).
- [ ] Tokyo-worker layered publish + index.json hybrid + cleanup plan.
- [ ] Publish ordering documented (overlay first, index last).
- [ ] Prague layered overlays + runtime composition.
- [ ] Composition timeout budget implemented.
- [ ] Overlay size limits enforced.
- [ ] Preview model decided and implemented (A or B) + Apply flow.
- [ ] Playbook metadata in registry + SF logging (optional Phase 4).
- [ ] Rollback flags documented per phase.
- [ ] Docs updated (BabelProtocol, localization.md, SF overview).
