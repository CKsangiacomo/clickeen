# PRD 049D - API Decomposition and Release Governance (Part of PRD 49)

**Status:** EXECUTING (Local complete; cloud-dev runtime verification pending)  
**Date:** 2026-02-19  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Parent PRD:** `Execution_Pipeline_Docs/02-Executing/049__PRD__Infra_and_Architecture_Recovery_Program.md`  
**Sequence:** D (final, after 049C)  
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

## 1) Architecture tenet lens for PRD D

1. `Tenet 12 (<=800 LOC)`: oversized API files are an architectural risk, not cosmetic debt.
2. `Tenet 2 (dumb orchestrators)`: decomposition must keep clean handler boundaries and avoid hidden side effects.
3. `Tenet 3 (fail visibly)`: release gates must block regressions deterministically before deploy.
4. `Tenet 11 (local/cloud parity)`: gate stack must run equivalently before local and cloud-dev release.
5. `Tenet 13 (no legacy/backcompat)`: no compatibility wrappers, alias routes, or dual handlers during decomposition.

---

## 2) Purpose

1. Split oversized API files into reviewable modules without behavior drift.
2. Enforce a durable `<=800 code LOC` limit across scoped API surfaces.
3. Wire release governance gates so A/B/C behavior cannot regress during decomposition.

This PRD executes Tenet 12 and closes the PRD 49 program.

---

## 3) Why this is last

1. Decomposition before contract stabilization mixes behavior change with structure change.
2. D must validate A/B/C behavior on the final integrated system.
3. Final governance is meaningful only when all contracts are already defined and passing.

## 3.1) Non-negotiable preconditions (must complete before first extraction commit)

1. Create `scripts/ci/check-api-code-loc.mjs` and verify it detects current known violations (`tokyo-worker/src/index.ts`, `paris/src/domains/roma/index.ts`, `paris/src/domains/workspaces/index.ts`, `paris/src/domains/l10n/index.ts`) in report output and fails in strict mode.
2. Add `test:api-loc` script alias in root `package.json` and verify it runs locally.
3. Make `scripts/verify-contracts.mjs` layout-resilient before decomposition (remove hard dependency on monolith file paths such as `tokyo-worker/src/index.ts`).
4. Add a pre-deploy governance gate step in both:
   - `.github/workflows/cloud-dev-workers.yml`
   - `.github/workflows/cloud-dev-roma-app.yml`
5. Precondition gate command stack (local and CI):

```bash
pnpm lint
pnpm typecheck
pnpm test:contracts
pnpm test:api-loc
```

6. No decomposition PR starts until precondition tooling is validated locally and in cloud-dev workflows.
7. Blocking enforcement on `main` must follow merge strategy in section 3.2.

## 3.2) Merge strategy for gate rollout (to avoid blocking main prematurely)

1. Blocking gates must not be merged to `main` while known violations still exceed limits.
2. Recommended strategy (default): land gate wiring + first LOC reductions in the same PR so `main` never carries a permanently failing required gate.
3. Fallback strategy (only if same-PR is impossible): introduce temporary non-blocking report mode in workflow for `test:api-loc`, then switch to blocking in the PR that reduces all known violations to `<=800`.
4. Temporary report mode must include an expiry condition in the same PR description (exact follow-up PR id and deadline).

---

## 4) Code-verified as-is issues

| Issue | Evidence | Impact |
| --- | --- | --- |
| Tokyo API worker is oversized | `tokyo-worker/src/index.ts` (3065 LOC) | Unreviewable blast radius, high regression risk. |
| Paris Roma domain API is oversized | `paris/src/domains/roma/index.ts` (2737 LOC) | Any change becomes opaque and risky. |
| Paris workspace domain API is oversized | `paris/src/domains/workspaces/index.ts` (2350 LOC) | Ownership boundaries are blurred and hard to test. |
| Paris L10n domain API is oversized | `paris/src/domains/l10n/index.ts` (1786 LOC) | L10n route and policy logic are unreviewable and violate Tenet 12 scope. |
| Worker entrypoints are pinned to monolith files | `tokyo-worker/wrangler.toml:2`, `paris/wrangler.toml:2` | Refactor must preserve entrypoint contracts or deploy breaks. |
| LOC gate script is referenced but missing | `Execution_Pipeline_Docs/02-Executing/049__PRD__Infra_and_Architecture_Recovery_Program.md:762` + missing `scripts/ci/check-api-code-loc.mjs` | Tenet 12 cannot be enforced in CI. |
| Deploy workflows skip quality/LOC gates | `.github/workflows/cloud-dev-workers.yml:38`, `.github/workflows/cloud-dev-roma-app.yml:46` | Deploy currently runs directly after dependency install; regressions can ship without block. |
| Contract verifier is coupled to monolith path tokens | `scripts/verify-contracts.mjs:217` | Naive decomposition can break contract gate even when behavior is correct. |

---

## 5) Target contracts

### C12-D: API code-LOC limit

1. Scoped API files must be `<=800 code LOC`.
2. `Code LOC` excludes blank lines and comment-only lines.
3. Gate fails on first violation with file path + measured LOC.
4. Scope includes:
   1. `tokyo-worker/src/**/*.ts`
   2. `paris/src/domains/**/*.ts`
   3. `roma/app/api/**/*.ts`
   4. `bob/app/api/**/*.ts`
5. Gate counts both `.ts` and `.tsx` files in scope.
6. Worker handlers and Next.js route handlers are measured with the same LOC rule (no framework-specific carve-out).
7. For this PRD, completion requires each currently violating monolith to be reduced to `<=800 code LOC`, not just extracted partially.
8. Tenet 12 text says “LOC”; this PRD operationalizes enforcement as `code LOC` for review density. Script output must include both `codeLoc` and `physicalLoc` for transparency.

### C12-D1: LOC gate algorithm (deterministic, no AST parsing)

1. Input files are read line-by-line.
2. A line counts as `code LOC` when:
   - after trimming, it is non-empty
   - it is not comment-only (`// ...`)
   - it is not fully inside a block comment span (`/* ... */`)
3. Lines containing code plus trailing comment still count as code.
4. Block-comment handling is stateful and deterministic; do not use TypeScript AST parsing for this gate.
5. Gate output format per violation: `{ path, codeLoc, physicalLoc, maxAllowed }`.

### D2: Decomposition contract

1. Public route contracts and response payloads remain unchanged.
2. Entry modules become thin routers/composers.
3. Business logic moves into domain-specific service modules.
4. Auth/policy/validation utilities are shared modules, not copied per route.
5. Remove legacy aliases/wrappers instead of keeping old and new handlers in parallel.
6. Paris/Tokyo extracted modules must import cross-cutting helpers from shared utility modules (`paris/src/shared/**`, `tokyo-worker/src/shared/**`) instead of duplicating utility code per domain.
7. If a shared helper does not exist, create it once in the shared layer and migrate all split modules to it before closing the PR.

### D3: Release governance contract

1. Local gates and cloud-dev gates run the same contract stack.
2. Deploy is blocked unless lint, typecheck, contracts, and LOC gate pass.
3. A/B/C validation matrix remains green after decomposition.
4. Governance split is explicit:
   - `Automated blocking gates`: lint, typecheck, `test:contracts`, `test:api-loc`
   - `Manual blocking sign-off`: 049A/049B/049C regression matrix execution evidence attached to PRD D execution report
5. `test:contracts` remains semantic:
   - layout-resilient checks must assert required contract truths (required route patterns, payload schema tokens, and fixtures), not “string appears somewhere” broad grep.
   - route-contract assertions must scan the expected module set and fail if any required pattern is missing.

### D13: No legacy/backcompat contract

1. Decomposition cannot introduce adapter layers that preserve obsolete internal API shapes.
2. Deprecated routes/exports identified in A/B/C must be removed, not shimmed.
3. “Temporary compatibility” is not allowed as a release strategy.
4. Allowed: internal thin delegation/re-export needed to preserve stable worker entrypoints (`main = "src/index.ts"`) while logic moves to modules.
5. Forbidden: parallel legacy and new behavior branches behind the same public route contract.

---

## 6) Cross-product dependency trace (anti-drift)

| Surface | Code evidence | Required change under PRD 49 tenets | Drift if skipped |
| --- | --- | --- | --- |
| Tokyo worker entrypoint | `tokyo-worker/wrangler.toml:2`, `tokyo-worker/src/index.ts:1` | Keep `main` contract stable while turning `src/index.ts` into thin router that delegates to extracted modules. | Deploy/runtime breaks or monolith remains >800 LOC. |
| Paris worker entrypoint | `paris/wrangler.toml:2`, `paris/src/index.ts:72` | Keep worker fetch/scheduled entrypoint stable while moving route logic to smaller domain routers/services. | Route behavior drifts or file remains unreviewable. |
| Paris Roma domain exports | `paris/src/index.ts:51`, `paris/src/domains/roma/index.ts:1` | Preserve exported handler names/signatures while splitting internals by capability (bootstrap, policy, widgets, templates, account/workspace authz). | Callers break or hidden behavior changes are introduced. |
| Paris workspace domain exports | `paris/src/index.ts:20`, `paris/src/domains/workspaces/index.ts:1` | Same contract-preserving split for instances, publish/render, business profile, creative endpoints. | Router drift and request mismatch risk. |
| Paris L10n domain exports | `paris/src/index.ts:27`, `paris/src/domains/l10n/index.ts:1` | Preserve route behavior for L10n generate/report/status while splitting l10n domain internals into smaller modules. | L10n contract drift or monolith remains >800 LOC. |
| Account asset routes from Paris | `paris/src/index.ts:394` | When splitting domain files, preserve account asset list/get/delete/replace contract introduced in 049B. | Asset lifecycle regresses after decomposition. |
| Roma Paris proxy layer | `roma/app/api/paris/[...path]/route.ts:46` | Keep proxy semantics and upstream error pass-through unchanged while underlying Paris modules are split. | Roma behavior changes despite “refactor-only” intent. |
| Bob Paris proxy routes | `bob/app/api/paris/workspaces/[workspaceId]/instance/[publicId]/route.ts:28`, `bob/app/api/paris/workspaces/[workspaceId]/instances/route.ts:39` | Preserve subject/workspace validation semantics and upstream request shape during Paris refactor. | Bob editor writes drift while APIs are being reorganized. |
| Contract verification script coupling | `scripts/verify-contracts.mjs:217` | Update checks to validate behavior/contracts independent of monolith file layout (avoid hard-coding implementation file paths when possible). | Refactor causes false negatives or missing coverage. |
| Root scripts and gate command availability | `package.json:26` | Add script alias for LOC gate (`test:api-loc` or equivalent) and include in shared validation commands. | Tenet 12 remains manual and unenforced. |
| CI deployment gates | `.github/workflows/cloud-dev-workers.yml:38`, `.github/workflows/cloud-dev-roma-app.yml:46` | Add pre-deploy gate stage with exact commands: `pnpm lint`, `pnpm typecheck`, `pnpm test:contracts`, `pnpm test:api-loc` before deploy/build steps. | Cloud-dev deploys structural regressions. |
| LOC gate behavior across Worker + Next API files | `tokyo-worker/src/index.ts:1`, `paris/src/domains/roma/index.ts:1`, `roma/app/api/bootstrap/route.ts:1`, `bob/app/api/paris/workspaces/[workspaceId]/instances/route.ts:1` | Implement one LOC algorithm for `.ts`/`.tsx` across Workers and Next route handlers (blank/comment-only lines excluded). | Gate passes/fails inconsistently by framework and creates false positives/negatives. |
| Shared utility extraction governance | `paris/src/shared`, `tokyo-worker/src` | During split, import cross-cutting auth/policy/validation helpers from shared modules; forbid per-domain utility duplication. | Decomposition ships with hidden utility forks and long-term drift. |
| Local canonical execution baseline | `scripts/dev-up.sh:4` | Validate decomposition against canonical local stack before cloud-dev deploy. | Team validates against divergent local process states. |
| Documentation truth alignment | `Execution_Pipeline_Docs/02-Executing/049__PRD__Infra_and_Architecture_Recovery_Program.md:24` | Keep umbrella PRD and A/B/C/D references aligned if module paths/check commands change. | Program docs drift from executable reality. |

Execution rule for this table:
1. Every row is blocking.
2. No waivers or compatibility exceptions.
3. “Refactor-only” is invalid unless A/B/C behavior tests stay green.

---

## 6.1) Decomposition map (required target structure)

### Tokyo Worker monolith (`tokyo-worker/src/index.ts`)

1. `tokyo-worker/src/routes/health.ts`: `/healthz`.
2. `tokyo-worker/src/routes/renders/*`: render index/published/revision/artifact/snapshot routes.
3. `tokyo-worker/src/routes/assets/*`: upload/delete/replace/pointer read routes (`/assets/*`, `/arsenale/*`).
4. `tokyo-worker/src/routes/l10n/*`: l10n publish/index/base/layer/versioned routes.
5. `tokyo-worker/src/routes/router.ts`: request dispatch composition only.

### Paris Roma monolith (`paris/src/domains/roma/index.ts`)

1. `paris/src/domains/roma/bootstrap/*`: bootstrap envelope and domain fanout loaders.
2. `paris/src/domains/roma/instances/*`: instance create/duplicate/write orchestration.
3. `paris/src/domains/roma/account/*`: billing/usage/settings/account summaries.
4. `paris/src/domains/roma/ai/*`: AI/capability policy projections.
5. `paris/src/domains/roma/index.ts`: thin exported handler wiring only.

### Paris Workspaces monolith (`paris/src/domains/workspaces/index.ts`)

1. `paris/src/domains/workspaces/instances/*`: instance CRUD + validation.
2. `paris/src/domains/workspaces/publish/*`: publish/render endpoints.
3. `paris/src/domains/workspaces/creative/*`: website creative endpoints.
4. `paris/src/domains/workspaces/asset-usage/*`: usage sync and strict checks.
5. `paris/src/domains/workspaces/index.ts`: thin exported handler wiring only.

### Paris L10n monolith (`paris/src/domains/l10n/index.ts`)

1. `paris/src/domains/l10n/generate/*`: generate request/queue/report flows.
2. `paris/src/domains/l10n/publish/*`: publish integration and state transitions.
3. `paris/src/domains/l10n/status/*`: status/read endpoints.
4. `paris/src/domains/l10n/index.ts`: thin exported handler wiring only.

## 7) Implementation scope

### Files/services touched

1. `tokyo-worker/src/index.ts` (split into routers/services)
2. `paris/src/index.ts` (thin route dispatch orchestration)
3. `paris/src/domains/roma/index.ts` (split)
4. `paris/src/domains/workspaces/index.ts` (split)
5. `paris/src/domains/l10n/index.ts` (split)
6. `paris/src/shared/**` (shared auth/policy/validation utilities reused by split modules)
7. `tokyo-worker/src/shared/**` (shared utility extraction for split routes)
8. `scripts/ci/check-api-code-loc.mjs` (new)
9. `package.json` (gate script wiring: `test:api-loc`)
10. `scripts/verify-contracts.mjs` (layout-resilient checks)
11. `.github/workflows/cloud-dev-workers.yml`
12. `.github/workflows/cloud-dev-roma-app.yml`
13. `Execution_Pipeline_Docs/02-Executing/049D__Execution_Report.md` (manual matrix evidence artifact)

### Required changes

1. Complete precondition phase first (`check-api-code-loc.mjs`, `test:api-loc`, layout-resilient `verify-contracts`, CI pre-deploy gate wiring).
2. Use the decomposition map in section 6.1 for all four oversized monoliths; arbitrary splits are not allowed.
3. Extract logic modules until every scoped API file is `<=800 code LOC`.
4. Keep route signatures, payload contracts, and authorization behavior unchanged.
5. Enforce one LOC gate algorithm across Worker and Next.js API files (`.ts` + `.tsx`, blank/comment-only excluded).
6. Enforce gates in both local command stack and cloud-dev workflow stack.
7. Re-run A/B/C regression matrices after split and block on regressions (manual sign-off evidence required until automation exists).
8. Remove legacy alias routes/wrappers and compatibility adapters surfaced during A/B/C execution.
9. Apply merge strategy from section 3.2 when wiring blocking gates to `main`.

---

## 8) Verification

### Precondition tooling validation

Run:

```bash
node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --mode report
node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --mode strict
```

Expected before decomposition:
1. Report mode lists four known violators:
   - `tokyo-worker/src/index.ts`
   - `paris/src/domains/roma/index.ts`
   - `paris/src/domains/workspaces/index.ts`
   - `paris/src/domains/l10n/index.ts`
2. Strict mode exits non-zero on the same set.
3. Workflow wiring follows section 3.2 (same-PR blocking rollout or temporary report mode with expiry).

### Static gates

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:contracts
pnpm test:api-loc
```

Expected:
1. All commands pass.
2. Every scoped API file reports `<=800` code LOC.
3. `test:api-loc` output is deterministic across Worker and Next.js route surfaces.
4. Gate output includes both `codeLoc` and `physicalLoc` for each violation.

### Integrated regression gates (manual blocking sign-off until automation exists)

1. Re-run 049A open/admin unification matrix.
2. Re-run 049B asset lifecycle and no-fallback matrix.
3. Re-run 049C bootstrap degradation and parity matrix.
4. Confirm no payload shape or reason-key regressions introduced by decomposition.
5. Confirm no compatibility adapter layers or legacy alias routes remain in scoped API surfaces.
6. Attach execution evidence to `Execution_Pipeline_Docs/02-Executing/049D__Execution_Report.md` (commands run, environment, pass/fail per matrix row).

### Deployment gates

1. CI blocks deploy when any automated gate fails once blocking mode is enabled (section 3.2).
2. Both `.github/workflows/cloud-dev-workers.yml` and `.github/workflows/cloud-dev-roma-app.yml` must run this pre-deploy stage before any build/deploy step:

```bash
pnpm lint
pnpm typecheck
pnpm test:contracts
pnpm test:api-loc
```

3. Local and cloud-dev pipelines execute equivalent automated gate sequence.
4. Decomposition PR cannot be approved without manual A/B/C matrix evidence file.
5. Workflow rollout follows section 3.2 merge strategy (no permanently failing required gate on `main`; temporary report mode allowed only with expiry).

---

## 9) Exit gate (blocking)

1. No scoped API file exceeds 800 code LOC.
2. Entrypoint contracts for Tokyo/Paris remain stable.
3. `scripts/ci/check-api-code-loc.mjs` exists, is wired to `pnpm test:api-loc`, and blocks CI deploy on violation.
4. `scripts/verify-contracts.mjs` is layout-resilient (no monolith path coupling) and remains green during decomposition.
5. A/B/C behavior and contracts remain green after decomposition (manual matrix evidence attached in `Execution_Pipeline_Docs/02-Executing/049D__Execution_Report.md`).
6. All dependency-table rows are complete.
7. No legacy/backcompat wrappers or alias routes remain in scoped API surfaces.

---

## 10) Program-close criteria (PRD 49)

1. 049A, 049B, 049C, and 049D exit gates are all green.
2. Peer-review checklist passes with no unresolved architecture drift items.
3. PRD 49 umbrella acceptance criteria are fully met.
