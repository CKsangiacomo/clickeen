# PRD 45 — Architecture Convergence and Scalability Hardening (Bob ↔ Paris ↔ Tokyo)

**Status:** EXECUTED (validated in local on 2026-02-13)  
**Date:** 2026-02-12  
**Owner:** Product Dev Team  
**Reviewers:** Product Dev Team peers + Human Architect  
**Environment scope:** Local first (`scripts/dev-up.sh`) then cloud-dev  
**Type:** Architecture hardening + scalability + complexity reduction  
**User-facing change:** No new end-user feature; faster iteration, lower regression risk, stronger architectural consistency

---

## 0) Executive summary

This PRD proposes a focused architecture hardening cycle on five issues identified in codebase analysis:

1. Widget-specific normalization logic exists inside Bob session orchestrator code.
2. Bob Paris proxy routes contain repeated boilerplate and inconsistent edge handling.
3. Tokyo local dev server and Tokyo Worker duplicate mutable route behavior.
4. Paris domain handlers contain very large files that increase merge conflicts and change risk.
5. Bob local preview/minibob loads are slowed by accumulated proxy + no-store + first-hit route compilation overhead.

This is a convergence PRD: no speculative platform rewrite, no product churn, no migration theater.  
The goal is to remove concrete architecture debt that blocks scaling across many widgets and multiple concurrent AI teams.

### 0.1 Execution outcome (local validation, 2026-02-13)

1. Workstream A shipped: FAQ normalization is contract-driven from widget spec; no `widgetname === 'faq'` branch remains in Bob session orchestration.
2. Workstream B shipped: Bob Paris route boilerplate is consolidated via shared proxy helpers.
3. Workstream C shipped: local mutable Tokyo l10n flows run through worker-compatible contract with non-recursive bridge handling.
4. Workstream D shipped: Paris l10n/workspaces domains are decomposed with reduced file size and preserved endpoint behavior.
5. Workstream E shipped (partial from original draft): blanket local no-store behavior was removed in Bob proxy paths; explicit cache-bust (`?ts`) remains no-store.
6. Deferred from original Workstream E draft: explicit startup prewarm and dedicated compiled-route memoization layer are not shipped in this cycle.
7. PRD 46 superseded upload path details from this PRD: canonical upload write path is now `POST /assets/upload`; legacy write endpoints (`/workspace-assets/upload`, `/curated-assets/upload`) are removed (`410`) and read-compat only.

---

## 1) Why now

### 1.1 Evidence from runtime code (current state)

1. Orchestrator impurity in Bob:
   - `bob/lib/session/useWidgetSession.tsx:160` (`normalizeFaqIds`)
   - `bob/lib/session/useWidgetSession.tsx:201` (`applyWidgetNormalizations`)
   - `bob/lib/session/useWidgetSession.tsx:203` (`if (widgetname === 'faq')`)
2. Repeated Paris proxy helper logic across many route files:
   - `bob/app/api/paris/**/route.ts` repeats `CORS_HEADERS`, `PARIS_DEV_JWT`, `resolveParisBaseOrResponse`, `fetchWithTimeout`.
3. Tokyo mutable API duplication across local dev and worker:
   - `tokyo/dev-server.mjs:476`, `tokyo/dev-server.mjs:526`, `tokyo/dev-server.mjs:579`, `tokyo/dev-server.mjs:758`
   - `tokyo-worker/src/index.ts:1605`, `tokyo-worker/src/index.ts:1616` and related l10n endpoints.
   - Worker HTTP route coverage is currently narrower for l10n mutable paths:
     - `tokyo-worker/src/index.ts:1627` only accepts `POST` for `/l10n/instances/:publicId/:layer/:layerKey`.
     - Dev server also handles `DELETE /l10n/instances/:publicId/:layer/:layerKey`, `POST|DELETE /l10n/instances/:publicId/index`, and `POST /l10n/instances/:publicId/bases/:baseFingerprint` (`tokyo/dev-server.mjs:526`, `tokyo/dev-server.mjs:581`, `tokyo/dev-server.mjs:616`).
   - Local topology currently relies on a bridge from worker -> dev-server for l10n artifacts:
     - `scripts/dev-up.sh:489` sets `TOKYO_L10N_HTTP_BASE` to local Tokyo dev server URL.
     - `tokyo-worker/src/index.ts:54` resolves that bridge.
4. Large-file hotspots that create ownership and review bottlenecks:
   - `paris/src/domains/l10n/index.ts` (2342 LOC)
   - `bob/lib/session/useWidgetSession.tsx` (1981 LOC)
   - `paris/src/domains/workspaces/index.ts` (1798 LOC)
   - `tokyo-worker/src/index.ts` (1751 LOC)
5. Local preview accumulation bottleneck in Bob:
   - Same-origin preview assets are served through Bob proxy URLs (`bob/lib/compiler/assets.ts`), which is correct for blob-origin safety.
   - Proxy routes force `cache: 'no-store'` and `Cache-Control: no-store` in local dev:
     - `bob/app/widgets/[...path]/route.ts:55`
     - `bob/app/widgets/[...path]/route.ts:60`
     - `bob/app/dieter/[...path]/route.ts:55`
     - `bob/app/dieter/[...path]/route.ts:60`
   - Widget compile endpoint is also no-store fetch path:
     - `bob/app/api/widgets/[widgetname]/compiled/route.ts:21`
     - `bob/lib/session/useWidgetSession.tsx:1717`
   - Prague minibob embeds Bob directly (`prague/src/blocks/minibob/minibob.astro:47`), so it inherits Bob local performance profile.

### 1.2 Why this matters to product velocity

1. Multi-team parallel editing becomes conflict-heavy in oversized, cross-cutting files.
2. Repeated route boilerplate drifts quickly and causes inconsistent behavior under pressure.
3. Widget count growth magnifies any orchestrator-level special case.
4. Local/cloud parity issues waste debugging time and reduce trust in the platform.
5. Local iteration loops are longer than necessary due to avoidable asset delivery overhead.

---

## 2) Architecture alignment target

This PRD directly aligns with:

1. `documentation/architecture/Tenets.md`
   - Tenet 1: Widget files are complete truth.
   - Tenet 2: Orchestrators are dumb pipes.
   - Tenet 3: System fails visibly.
2. `documentation/architecture/CONTEXT.md`
   - Pre-GA contract: strict contracts, fail-fast, no hidden fallback behavior.
3. `documentation/architecture/Overview.md`
   - Clear responsibility boundaries across Bob, Paris, Tokyo, Venice, Prague.

---

## 3) Goals and non-goals

### 3.1 Goals

1. Remove widget-specific normalization from Bob session orchestrator path.
2. Consolidate Bob Paris proxy behavior into reusable typed helpers.
3. Make Tokyo Worker the single implementation authority for mutable Tokyo routes in local dev.
4. Reduce large-file risk in Paris domains with minimal behavior change.
5. Preserve runtime behavior and published contract compatibility.
6. Reduce local Bob/minibob preview warm-load latency without breaking same-origin preview guarantees.

### 3.2 Non-goals

1. No user-facing redesign of Bob/DevStudio/Prague.
2. No database schema reset or destructive data operations.
3. No broad “modernization” refactor unrelated to the goals above.
4. No change to core public endpoint shapes unless explicitly called out here.

---

## 4) Scope (what / why / how)

## 4.1 Workstream A — Orchestrator purity in Bob

### What

Move widget-specific normalization logic out of `useWidgetSession` and into widget-authored contracts interpreted by generic engine code.

### Why

Current logic hard-codes FAQ behavior in core orchestrator path, violating Tenet 2 and increasing future widget onboarding cost.

### How

1. Introduce optional `normalization` contract in widget definition (`tokyo/widgets/{widget}/spec.json`).
2. Add compiler support to parse and expose normalized contract metadata in compiled output.
3. Build generic normalization executor in Bob session layer that applies contract rules without widget name branching.
4. Migrate FAQ behavior from hard-coded function to contract-driven rules.
5. Remove `widgetname === 'faq'` branch and related FAQ-specific normalizer from session orchestrator.

### Initial contract shape (v1)

```json
{
  "normalization": {
    "idRules": [
      { "arrayPath": "sections", "idKey": "id", "seedKey": "title", "fallbackPrefix": "section" },
      { "arrayPath": "sections[].faqs", "idKey": "id", "seedKey": "question", "fallbackPrefix": "q" }
    ],
    "coerceRules": [
      { "path": "sections[].faqs[].defaultOpen", "type": "boolean", "default": false }
    ]
  }
}
```

This keeps widget truth in Tokyo files and keeps Bob orchestrator generic.

---

## 4.2 Workstream B — Bob Paris proxy consolidation

### What

Create one shared proxy core and reduce each `bob/app/api/paris/**/route.ts` file to thin endpoint wiring.

### Why

Dozens of route files currently duplicate base URL resolution, auth header injection, timeout wrapping, and error response translation.

### How

1. Add shared helper module (proposed path: `bob/lib/paris-proxy/core.ts`).
2. Centralize:
   - Paris base resolution + fail-visible error
   - Standard CORS headers
   - Dev JWT header forwarding
   - timeout + abort logic
   - consistent proxy error serialization
3. Migrate routes incrementally in groups:
   - group 1: `instances`, `instance/[publicId]`, `widgets`
   - group 2: workspace locale/l10n routes
   - group 3: publish/render-snapshot + personalization routes
4. Preserve existing response status/body contracts.

---

## 4.3 Workstream C — Tokyo mutable API parity (local vs worker)

### What

Turn mutable Tokyo endpoints in local dev server into proxy pass-through to Tokyo Worker, making worker logic the single source of truth.

### Why

Duplicate implementations for uploads/l10n create local-cloud drift risk and duplicate maintenance.

### How

1. Phase C0 (prerequisite gate): define canonical mutable API contract in worker shape.
   - Canonical error format is structured worker JSON (`{ error: { kind, reasonKey, ... } }`).
   - Dev-server compatibility may be temporary, but the target contract is worker-first.
2. Phase C0 (prerequisite gate): close worker l10n route surface gaps required by current local flows.
   - Add worker support for:
     - `DELETE /l10n/instances/:publicId/:layer/:layerKey`
     - `POST /l10n/instances/:publicId/index`
     - `DELETE /l10n/instances/:publicId/index`
     - `POST /l10n/instances/:publicId/bases/:baseFingerprint`
3. Phase C0 (prerequisite gate): resolve local topology dependency before l10n proxy cutover.
   - Current local bridge uses `TOKYO_L10N_HTTP_BASE` (worker -> dev-server).
   - Avoid request loops/recursion when dev-server starts proxying l10n paths to worker.
   - Explicitly gate l10n cutover on validated non-recursive topology.
4. Phase C1 (safe cutover): proxy canonical upload endpoint first:
   - `POST /assets/upload`
5. Phase C2 (gated cutover): proxy l10n endpoints only after C0 is complete:
   - `POST|DELETE /l10n/instances/:publicId/:layer/:layerKey`
   - `POST|DELETE /l10n/instances/:publicId/index`
   - `POST /l10n/instances/:publicId/bases/:baseFingerprint`
6. Keep `tokyo/dev-server.mjs` focused on static/dev asset serving once cutover completes.
7. Add parity checks in local smoke scripts with route-by-route response/body/status matrix.

---

## 4.4 Workstream D — Paris large-file decomposition (behavior-preserving)

### What

Modularize oversized domain handlers with no endpoint changes.

### Why

Large monolithic files are high-risk for concurrent edits and make defects harder to isolate.

### How

1. Start with `paris/src/domains/l10n/index.ts`:
   - split into `validation.ts`, `handlers.ts`, `service.ts`, `types.ts` (folderized domain).
2. Keep `index.ts` as route map/wiring only.
3. Apply same pattern to `paris/src/domains/workspaces/index.ts` after l10n stabilization.
4. Add focused unit coverage to protect behavior during extraction.

---

## 4.5 Workstream E — Bob local preview performance hardening (no contract drift)

### What

Reduce local Bob/minibob load time by removing avoidable no-store pressure and first-hit route compile pain, while preserving same-origin preview constraints.

### Why

Current local flow accumulates delay across many asset and API requests:
1. Bob preview asset URLs intentionally route through Bob (`/widgets/*`, `/dieter/*`) for same-origin blob safety.
2. Those proxy routes force no-store in dev, disabling effective browser reuse.
3. Widget compile endpoint (`/api/widgets/:widget/compiled`) is no-store end-to-end.
4. First-hit route compilation in Next dev adds one-time seconds per route.
5. Prague minibob inherits this because it embeds Bob directly.

This is an accumulation bottleneck, not a single slow Paris query.

### How

1. Keep same-origin preview architecture unchanged (no direct Tokyo iframe switch).
2. In Bob proxy routes, stop forcing `Cache-Control: no-store` for all local requests by default:
   - retain explicit bust behavior when `?ts=` is present,
   - add optional explicit dev bypass flag (`?devNoStore=1`) for debugging only.
3. Add memoized compiled-widget cache in Bob API route for local dev, keyed by widget type + source freshness signals (spec/limits etag or last-modified + manifest gitSha).
4. Add startup prewarm step in local dev script to hit high-cost Bob routes once (`/api/widgets/{widget}/compiled`, `/widgets/{widget}/widget.html`, `/dieter/tokens/tokens.css`).
5. Preserve fail-visible behavior and correctness over speed:
   - on cache key uncertainty, fail-open to re-fetch/recompile,
   - no stale data hiding.

---

## 5) Execution plan

## 5.1 Phase order

1. Phase 0: Workstream C prerequisites (C0).
   - Worker l10n mutable route parity for local-required endpoints.
   - Canonical worker response contract declared.
   - Local non-recursive topology for l10n bridge validated.
2. Phase 1: Workstream E (local preview performance hardening).
3. Phase 2: Workstream B (proxy core) + low-risk route migration.
4. Phase 3a: Workstream C upload parity cutover (C1).
5. Phase 3b: Workstream C l10n parity cutover (C2, gated on Phase 0 completion).
6. Phase 4: Workstream A (normalization contract + FAQ migration).
7. Phase 5: Workstream D (l10n decomposition, then workspaces).

Rationale: start with high-leverage low-semantics changes, then tackle contract/behavior changes.

## 5.2 Branching and merge strategy

1. Small PRs per workstream phase, no mega-PR.
2. Keep each PR deployable and reversible.
3. Avoid touching unrelated files to reduce cross-team collision.

## 5.3 Environment flow

1. Local validation first (`scripts/dev-up.sh`).
2. Cloud-dev promotion after local parity checks pass.
3. No destructive Supabase operations.

---

## 6) Acceptance criteria

## 6.1 Functional

1. No widget-specific branch remains in `useWidgetSession` for FAQ normalization.
2. Bob Paris proxy endpoints preserve existing status/body behavior for success and error paths.
3. Upload mutable routes resolve through worker path in local via canonical `POST /assets/upload` (legacy write paths now return `410`).
4. L10n mutable routes resolve through worker path in local only after Phase 0 gates are complete, with no recursive loop behavior.
5. Worker and local route contracts are explicitly aligned for status/body/error shape on mutable endpoints.
6. Paris l10n/workspaces endpoint contracts remain unchanged while file decomposition lands.
7. Local Bob/minibob warm-load preview path is materially faster without changing preview correctness.

## 6.2 Architecture

1. Tenet 2 compliance improved: orchestrator path has no widget-specific special case.
2. Tenet 1 compliance improved: normalization rules live with widget definition contract.
3. Fail-visible behavior preserved for misconfiguration and invalid inputs.
4. Bob preview remains same-origin and deterministic (no direct-origin shortcut that breaks blob URL constraints).

## 6.3 Scalability and maintainability

1. Shared proxy helper removes repeated boilerplate in Paris proxy route files.
2. Mutable Tokyo route logic has one source of truth (worker), with explicit parity contract coverage for uploads + l10n.
3. Largest domain file size decreases materially in Paris with clear module boundaries.
4. Local dev retains speed and correctness as widget and Dieter asset counts grow.

## 6.4 Local performance SLO (development)

1. Warm load (same widget/publicId, local): Bob/minibob first visible preview target <= 5s on standard dev machine.
2. Cold load (fresh process): first visible preview target <= 20s after `scripts/dev-up.sh` completes.
3. No correctness regression in preview state sync, locale application, or asset rendering.

---

## 7) Verification plan

## 7.1 Automated

1. `pnpm lint`
2. `pnpm typecheck`
3. targeted tests:
   - Bob proxy route tests (or integration assertions where available)
   - Paris l10n/workspaces regression tests
   - Tokyo local/worker parity smoke checks (uploads + l10n route matrix)
   - Topology guard tests to ensure no worker<->dev-server recursion in local l10n publish path
   - Bob compiled-route cache key / invalidation tests

## 7.2 Manual smoke (local)

1. Start stack with `scripts/dev-up.sh`.
2. Edit/publish FAQ and confirm IDs/defaultOpen normalize correctly through contract path.
3. Hit representative Bob proxy endpoints and confirm response parity.
4. Validate asset upload + l10n endpoints through Tokyo local dev path.
5. Measure Bob preview/minibob cold and warm load timings and record deltas before/after.
6. Validate that local l10n publish path remains non-recursive with current `TOKYO_L10N_HTTP_BASE` strategy.

---

## 8) Risks and mitigations

## 8.1 Risks

1. Contract-based normalization may miss legacy edge cases currently handled by bespoke function.
2. Route consolidation may accidentally alter subtle response headers/status handling.
3. Tokyo proxy pass-through may expose timeout/backpressure differences in local workflows.
4. Large-file decomposition may introduce import cycles or accidental behavior drift.
5. Aggressive local caching could mask asset/spec freshness bugs if invalidation is wrong.
6. Worker/dev-server response contract divergence can break parity assumptions during cutover.
7. Local l10n topology can create recursion if worker bridge and dev-server proxying are enabled without guards.

## 8.2 Mitigations

1. Snapshot before/after behavior tests on FAQ normalization payloads.
2. Golden-response assertions for proxy route status/body/header expectations.
3. Explicit timeout configuration and retry visibility in Tokyo local proxy flow.
4. Stepwise extraction with tests passing at every move.
5. Cache-key invalidation tests + explicit dev bypass switch for cache debugging.
6. Canonical worker contract definition + route-by-route parity tests before cutover.
7. Phase-gated l10n proxy cutover only after non-recursive topology validation.

---

## 9) Required documentation updates (definition of done)

When execution completes, update:

1. `documentation/architecture/CONTEXT.md` (if normalization contract becomes canonical).
2. Relevant service docs in `documentation/services/` for Bob/Tokyo/Paris route behavior changes.
3. Move PRD from `01-Planning` to `02-Executing` only after peer review confirms readiness.
4. Move PRD to `03-Executed` only after runtime + docs both reflect shipped behavior.

---

## 10) Peer review checklist (explicit answers required)

The first peer review must answer all four questions with concrete file references:

1. Does this plan use elegant engineering and scale across 100s of widgets?
2. Is this plan compliant with architecture and tenets?
3. Does this plan avoid over-architecture and unnecessary complexity?
4. Does this plan move us toward intended architecture and product goals?

Reviewer format:

```md
- Q1: Yes/No + evidence
- Q2: Yes/No + evidence
- Q3: Yes/No + evidence
- Q4: Yes/No + evidence
- Required changes before 02-Executing:
```

---

## 11) Decision log

1. We prioritize contract-based normalization over hard-coded widget conditionals.
2. We consolidate route behavior before deeper domain refactors.
3. We choose single-source worker behavior for mutable Tokyo routes in local dev.
4. We decompose large domain files incrementally, behavior-first, no API redesign.
5. We treat Bob local preview performance as an architecture concern (delivery path + caching contract), not a one-off tuning hack.
6. We phase Tokyo parity with explicit prerequisite gates (contract parity + non-recursive topology) before l10n proxy cutover.

---

## 12) Out-of-scope reminders for execution team

1. Do not reset/rebase/clean forcefully in shared branches.
2. Do not introduce fallback behavior that hides contract errors.
3. Do not add speculative abstractions beyond this PRD scope.
4. Do not create or edit instance data as part of this architecture work unless explicitly directed by human architect.

---

## 13) 02-Executing Entry Gates (historical record)

1. Workstream C Phase 0 prerequisites are implemented and verified:
   - Worker route parity added for local-required l10n mutable paths.
   - Canonical worker response contract documented and accepted.
   - Local non-recursive topology for l10n bridge validated.
2. Workstream C is explicitly split in execution artifacts:
   - Phase 3a: upload parity cutover.
   - Phase 3b: l10n parity cutover (gated).
3. Route parity matrix is recorded for mutable Tokyo endpoints (status/body/error contract), including:
   - `/assets/upload`
   - `/l10n/instances/:publicId/:layer/:layerKey` (POST/DELETE)
   - `/l10n/instances/:publicId/index` (POST/DELETE)
   - `/l10n/instances/:publicId/bases/:baseFingerprint` (POST)
4. Rollback toggle points are identified per phase (Phase 1 through Phase 5) before coding begins.
