# PRD 48 — Roma Model Unification and Legacy-Zero Hard Cut

**Status:** EXECUTING  
**Date:** 2026-02-16  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Type:** Architecture convergence + product hardening + complexity deletion  
**User-facing change:** Yes (simpler, more predictable workspace/account behavior)

---

## 0) Executive summary

This PRD is the execution memo for removing the current account/workspace/instance complexity cluster and converging Roma/Bob/Paris to one clean model.

The hard target model is:

1. Runtime authoring objects are workspace-owned:
   - `widget_instances`
   - assets used by instances
2. Account is the commercial rollup boundary:
   - billing
   - usage aggregation across workspaces
3. One auth/authz pipeline:
   - Supabase principal + membership + policy
   - no product-path dual auth or dev-token branch logic
4. Zero legacy/back-compat in product paths:
   - no parallel endpoint contracts
   - no temporary shims kept alive after cutover
5. Dev/Admin is a normal super account/profile:
   - unlimited entitlements in policy
   - no ad hoc bypass headers or transport hacks

This is a hard-cut pre-GA convergence effort. The goal is smooth, scalable, elegant product behavior with one mental model.

---

## 1) Problem statement (why this is blocking product quality)

Current architecture has multiple overlapping control planes:

1. Auth and authorization split across different endpoint families.
2. Tenant boundaries are valid but unevenly expressed (and blurred in UI routing/state).
3. Legacy and workspace-scoped instance APIs coexist.
4. Bootstrap and handoff flows add additional state machines in core product paths.
5. Dev behavior uses ad hoc compatibility paths instead of the product contract.

This produces:

1. Higher cognitive load for every feature/fix.
2. Inconsistent behavior across surfaces.
3. Larger test matrix and higher regression risk.
4. More merge conflicts across teams touching the same cross-cutting files.
5. UX confusion because architecture complexity leaks into user-facing flows.

---

## 2) Hard decisions (non-negotiable architecture contracts)

## 2.1 Ownership contracts

1. Workspace owns authoring/runtime data.
2. Account owns commercial aggregation and platform-level controls.
3. Assets are workspace-owned; account usage/billing are computed aggregates.

## 2.2 Auth/authz contracts

1. Product endpoints accept one auth mode: Supabase principal.
2. Authorization is membership + policy-driven, server-side.
3. No product endpoint may rely on `PARIS_DEV_JWT` fallback semantics.

## 2.3 Policy contracts

1. Entitlements matrix remains the single source of capability truth.
2. Policy subject/profile resolution comes from trusted server context, not arbitrary query params.
3. Dev super behavior is expressed by policy profile/role, not endpoint bypass.

## 2.4 API topology contracts

1. Workspace-scoped instance APIs are canonical.
2. Legacy parallel routes are removed, not deprecated forever.
3. Roma/Bob use one canonical instance contract end-to-end.

## 2.5 UX/context contracts

1. Active workspace context is explicit in Roma.
2. Workspace pages call workspace APIs only.
3. Account pages call account-level commercial/aggregation APIs only.
4. No implicit context fallback that silently changes account/workspace.

## 2.6 Pre-GA execution contracts

1. No compatibility shims for removed product-path contracts.
2. No partial “both old and new” steady state.
3. Cut over, delete old path, and update canonical docs.

---

## 3) Target architecture (end state)

## 3.1 Domain boundaries

1. `workspace`:
   - instance CRUD and publish
   - workspace asset library and usage mapping
   - team/members, AI profile/limits, localization, builder context
2. `account`:
   - billing
   - usage rollups and limits rollups across account workspaces
   - account-level settings/admin controls

## 3.2 Request path

1. Client authenticates with Supabase.
2. Roma/Bob proxy forwards bearer token.
3. Paris resolves principal, workspace/account membership, role, profile.
4. Paris resolves policy from canonical context.
5. Handler executes under one contract.

## 3.3 Dev super account model

1. Dev admin user is a normal principal in the same model.
2. Super profile grants unlimited entitlements via policy.
3. Same route contracts and validation apply.
4. No `x-account-id` product-path bypass behavior.

---

## 4) Scope and non-goals

## 4.1 In scope

1. Auth/authz unification in Paris + Roma/Bob proxies.
2. Legacy API removal and canonical workspace API hard cut.
3. Workspace-owned asset domain migration and API convergence.
4. Bootstrap and handoff simplification to linear idempotent flows.
5. Roma UX context cleanup (explicit active workspace model).
6. Dev super account/profile convergence.

## 4.2 Out of scope

1. New pricing model design.
2. Full redesign of AI agent topology.
3. Marketing information architecture redesign.
4. Non-essential UI redesign not tied to model clarity.

---

## 5) Workstreams and execution phases

## Phase 1 — Auth/authz and policy unification

### Objectives

1. Remove split product auth paths.
2. Make policy and authorization deterministic across domains.

### Core changes

1. Paris:
   - converge product handlers on Supabase-principal auth path
   - centralize authorization helpers for workspace/account checks
   - stop using dev-token compatibility behavior in product handlers
2. Bob/Roma:
   - remove automatic dev token injection on product proxy paths
   - forward session bearer from normal auth context
3. Identity:
   - remove dev `/api/me` special ownership semantics from product path

### Acceptance

1. Same principal sees consistent authz behavior across all workspace/account endpoints.
2. No product endpoint depends on dev-token fallback behavior.

---

## Phase 2 — Legacy API hard cut

### Objectives

1. Eliminate parallel legacy instance contracts.
2. Keep one canonical workspace instance contract.

### Core changes

1. Remove legacy instance routes from Paris product surface.
2. Remove special-case proxies that preserve legacy shape.
3. Keep one route family for instance load/update/create/list in workspace scope.
4. Update Roma/Bob call sites to canonical routes only.

### Acceptance

1. No active product call path uses legacy instance endpoints.
2. No parallel route family retained “just in case.”

---

## Phase 3 — Workspace-owned assets convergence

### Objectives

1. Align asset ownership with runtime authoring boundary.
2. Preserve account-level usage/billing rollup semantics.

### Core changes

1. Data model:
   - migrate asset ownership to workspace scope
   - ensure account linkage is derived via workspace->account relation
2. APIs:
   - canonical asset endpoints become workspace-scoped
   - account endpoints return aggregated asset usage rollups only
3. Validation:
   - cross-workspace asset references are fail-fast denied
4. Upload flows:
   - Bob/Roma upload and persistence use workspace-owned contract

### Acceptance

1. Assets are created/read/deleted through workspace ownership paths.
2. Account usage/billing still report aggregate totals correctly.

---

## Phase 4 — Bootstrap and handoff simplification

### Objectives

1. Reduce hidden state machines in core product paths.
2. Keep deterministic idempotent onboarding/continuation behavior.

### Core changes

1. Onboarding:
   - replace multi-step bootstrap marker logic with one idempotent flow
2. MiniBob handoff:
   - replace heavy KV continuation state with signed deterministic continuation contract
   - keep replay-safe idempotency semantics
3. Remove redundant state branches after cutover.

### Acceptance

1. Onboarding and continuation are linear and deterministic.
2. Reduced KV dependency in core request path.

---

## Phase 5 — Roma context and UX contract cleanup

### Objectives

1. Make workspace/account context explicit.
2. Stop implicit context drift in UI.

### Core changes

1. Add explicit active workspace context model.
2. Remove silent fallback context resolution behavior for critical paths.
3. Separate domain screens by boundary:
   - workspace domains use workspace context only
   - account domains use account context only
4. Simplify Builder route/query contract to required minimal context.

### Acceptance

1. User can clearly understand active workspace and account scope.
2. No domain mixes workspace/account calls without explicit reason.

---

## Phase 6 — Dev super account convergence

### Objectives

1. Remove ad hoc “dev-mode transport hacks.”
2. Make dev/admin use real product contracts.

### Core changes

1. Add/confirm super profile in policy matrix (unlimited entitlements).
2. Map dev admin users/accounts to that profile through normal auth path.
3. Remove bypass headers and compatibility-only ownership checks from product paths.
4. Keep only non-product internal tooling routes explicitly isolated if needed.

### Acceptance

1. Dev users exercise the same product route contracts.
2. “Unlimited” comes from policy, not from bypass logic.

---

## 6) File/system impact map (execution reference)

## 6.1 Paris (primary)

1. `paris/src/shared/auth.ts`
2. `paris/src/shared/policy.ts`
3. `paris/src/index.ts`
4. `paris/src/domains/identity/index.ts`
5. `paris/src/domains/roma/index.ts`
6. `paris/src/domains/workspaces/index.ts`
7. `paris/src/domains/accounts/index.ts`
8. `paris/src/domains/instances/index.ts`

## 6.2 Roma (primary)

1. `roma/lib/auth/session.ts`
2. `roma/app/api/paris/[...path]/route.ts`
3. `roma/app/api/paris/instance/[publicId]/route.ts`
4. `roma/components/use-roma-me.ts`
5. `roma/components/*-domain.tsx` boundary cleanup

## 6.3 Bob (secondary but high-impact)

1. `bob/lib/api/paris/proxy-helpers.ts`
2. `bob/app/api/paris/**`
3. `bob/lib/session/useWidgetSession.tsx` context + canonical endpoint calls

## 6.4 Prague (handoff integration)

1. `prague/src/pages/api/minibob/handoff-start.js`
2. `prague/src/blocks/minibob/minibob.astro`

## 6.5 Supabase schema/migrations

1. Asset ownership migration (workspace-owned)
2. Constraint/index updates for new canonical ownership contract
3. Backfill + verification scripts (non-destructive)

## 6.6 Canonical docs (must update when each phase ships)

1. `documentation/architecture/CONTEXT.md`
2. `documentation/services/paris.md`
3. `documentation/services/bob.md`
4. `documentation/capabilities/multitenancy.md`
5. `documentation/services/michael.md`

---

## 7) Acceptance criteria (global)

1. One product auth path (Supabase principal) for non-public endpoints.
2. One canonical instance API family (workspace-scoped).
3. Assets are workspace-owned in runtime model.
4. Account usage/billing are aggregate-only commercial views.
5. Dev/admin behavior uses super profile, not bypass transport logic.
6. No legacy compatibility route still active in product paths.
7. Roma UI boundaries are explicit and consistent.
8. Bootstrap/handoff flows are linear, deterministic, and lower-complexity.

---

## 8) Validation plan

1. Local integration validation per phase:
   - run service-level tests
   - run end-to-end smoke on Roma -> Bob -> Paris -> Supabase path
2. Cloud-dev promotion per phase:
   - same smoke matrix
   - explicit contract checks on removed legacy routes (must fail as removed)
3. Policy validation:
   - workspace standard user
   - workspace admin
   - super/dev admin
   - cross-workspace boundary denial checks

---

## 9) Risk controls

1. Execute as phased hard-cuts, not one mega-change.
2. Keep each phase deployable and testable independently.
3. Do not retain dual-path steady state after each phase cut.
4. Prefer explicit failures over hidden fallback behavior.
5. Keep schema changes non-destructive and forward-only.

---

## 10) Done definition

This PRD is done only when:

1. All phases above are shipped in local then cloud-dev.
2. Legacy product paths are deleted, not just unused.
3. Canonical `documentation/` reflects shipped behavior.
4. Team can explain account/workspace/instance/asset model in one sentence without exceptions.

