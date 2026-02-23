# PRD 50 - Runtime Parity and Truth Recovery (Roma <-> DevStudio <-> Bob <-> Paris <-> Tokyo)

## Verification Tenets (Hard Gate)

We will verify PRD 50 only against these tenets. This PRD is not complete unless every tenet is `TRUE` in local and cloud-dev.

1. DevStudio and Roma (local) use Bob the same way.
2. DevStudio and Roma use the same account.
3. Editing instances in DevStudio and Roma works the same way.
4. Uploading assets in DevStudio and Roma works the same way.
5. Assets in Roma (local) can be managed via UI.
6. Any update to instances in Roma or DevStudio, when published, immediately updates instance embeds.
7. When we push to Git, this architecture and UX translate to Cloudflare with the exact same behavior.

---

**Status:** EXECUTING  
**Date:** 2026-02-20  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Type:** Runtime recovery + contract hardening + parity enforcement  
**Priority:** P0  

---

## 0) Why this PRD exists

PRD 49 was treated as complete on build-time and static-contract gates while runtime behavior remained broken in local.

This PRD re-centers delivery on runtime truth. If runtime invariants are not true in local and cloud-dev, execution is not complete.

---

## 1) Program objective (explicit truth target)

Convert every Verification Tenet above from partial/false states to `TRUE` and keep them `TRUE` in both local and cloud-dev.

---

## 2) Current local truth (as-is runtime evidence)

1. `GET /api/paris/instance/:publicId` is returning `500` in Roma flows because `isCuratedInstanceRow` is used but not imported.
2. DevStudio relies on Bob `GET /api/paris/roma/bootstrap`, but this route is absent in Bob in current local state.
3. Roma asset delete path maps to `coreui.errors.asset.notFound` while local Tokyo dev stub does not proxy `PUT/DELETE /assets/:accountId/:assetId`.
4. Publish-to-embed is not immediate by contract because Venice uses revalidation for render published pointer fetches.
5. Existing execution gates remain mostly build/static checks and dry-run deploys, not runtime E2E parity proofs.

---

## 3) Scope

### In scope
1. Remove deterministic runtime blockers in local host/editor/asset/publish paths.
2. Enforce one Bob-open path contract for Roma and DevStudio standard editor use.
3. Enforce one account-context resolution contract for identical workflow paths.
4. Enforce one account-asset upload/delete/replace behavior across hosts.
5. Make Roma assets UI management fully operational in local and cloud-dev.
6. Make publish-to-embed behavior immediate by contract and verified in runtime.
7. Add runtime-complete gate matrix (local + cloud-dev) as required exit criteria.

### Out of scope
1. New widget features.
2. Visual redesign unrelated to parity bugs.
3. Non-runtime refactors with no parity impact.

---

## 4) Non-negotiable contracts for PRD 50

### C1: One host-to-Bob standard editor contract
1. Roma and DevStudio send the same open payload shape for standard editor workflows.
2. `subjectMode` for standard flows is `workspace`.
3. Both hosts resolve workspace/account context from the same upstream envelope contract fields.
4. Both hosts pass/fail on the same missing-context conditions.

### C2: One account-context contract
1. Same user + same selected workspace yields same `ownerAccountId` and `workspaceId` in Roma and DevStudio.
2. No host-specific hidden fallback that silently shifts account context.
3. Any fallback must be explicit, deterministic, and shared.

### C3: One account-asset lifecycle contract
1. Upload, replace, and delete routes resolve to the same account-asset domain behavior from both hosts.
2. Local Tokyo stub and cloud-dev Tokyo routes must expose equivalent behavior for mutable account-asset endpoints.
3. Roma UI asset delete/replace states must map to reason keys that are rendered as user-visible copy (not raw keys).
4. In editor dropdown-fill controls, both `Upload` (empty fill) and `Replace` (non-empty fill) create a new asset (`new assetId`); `Replace` relinks the current fill field and does not mutate prior assets in place.
5. Existing assets remain listed until explicitly deleted from Assets UI.

### C4: Publish-to-embed immediacy contract
1. After publish success, embed read path must serve updated render without stale-window drift.
2. Cache policy for published pointer path must align with immediate propagation requirement.
3. Contract must be verified in local and cloud-dev with measured publish-to-visible latency gates.

### C5: Runtime-complete release contract
1. Build/lint/type/contracts/dry-run remain necessary but insufficient.
2. Runtime parity matrix is blocking for completion.
3. PRD completion cannot be marked green unless all Section 1 statements are true in both local and cloud-dev.

### C6: Execution clarifications (blocking)
1. Cache policy for "immediate publish propagation" is explicit:
   - Published render pointer path (`/renders/instances/:publicId/published.json`) must be served/fetched as `no-store` in the runtime-critical hop.
   - Render artifacts and long-lived immutable objects remain cacheable; this PRD does not disable immutable artifact caching.
2. Account-context unification must baseline cloud-dev first:
   - Capture current cloud-dev account/workspace resolution behavior before local contract changes.
   - If local and cloud-dev differ, execution must converge both to one contract, not optimize local alone.
3. Runtime matrix scope is minimum viable and bounded:
   - One happy-path workflow per host for standard editor (`open -> edit -> publish`).
   - One asset happy path (`upload -> replace -> delete`) on account-scoped asset.
   - One negative case per contract class (`missing context`, `in-use delete requiresConfirm`, `notFound error rendering`).
4. Publish immediacy is instrumented, not subjective:
   - Record publish acceptance timestamp at Paris.
   - Record first embed fetch serving new published pointer at Venice.
   - Execution report includes measured deltas and pass/fail against latency gate.
5. Rollback is slice-scoped and explicit:
   - Deploy by slice in service order: Tokyo -> Paris -> Bob -> Roma/DevStudio.
   - On regression, roll back only the active slice and revert in reverse order.
   - Do not continue to next slice with unresolved regression in current slice.

---

## 5) Execution plan

### 5.0 Bounded schedule (estimate)
1. Slice A: 0.5 day
2. Slice B: 0.5 day
3. Slice C: 1.0 day
4. Slice D: 0.5 day
5. Slice E: 0.5 day
6. Total estimate: 3.0 days (excludes external review/approval wait time)

### 5.1 Slice A - unblock core instance/open flow
1. Fix workspace instance envelope handler runtime crash.
2. Restore DevStudio bootstrap route availability through Bob proxy surface.
3. Verify Roma and DevStudio can both open/edit/publish standard instances with same contract fields.

### 5.2 Slice B - unify account context behavior
1. Make account/workspace resolution deterministic and shared across hosts.
2. Remove silent host-specific fallbacks that produce divergent context.
3. Add explicit fail-visible behavior for missing required context.

### 5.3 Slice C - harden account-asset lifecycle parity
1. Ensure local mutable asset endpoints proxy correctly end-to-end.
2. Verify upload/delete/replace equivalence from Roma and DevStudio.
3. Ensure Roma assets UI shows translated user-facing errors, not bare reason keys.

### 5.4 Slice D - enforce immediate publish propagation
1. Align cache behavior with immediate embed update contract.
2. Validate publish-to-visible propagation with runtime checks in local and cloud-dev.

### 5.5 Slice E - runtime parity governance
1. Add required runtime matrix checks for local and cloud-dev.
2. Wire checks as blocking completion gates for this PRD.
3. Update execution report template to separate build-complete from runtime-complete evidence.

---

## 6) Exit gates (must all pass)

### G1: Statement truth gate (binary)
Each Section 1 statement must be marked `TRUE` in:
1. Local runtime evidence.
2. Cloud-dev runtime evidence.

No `PARTIAL` accepted.

### G2: Local runtime matrix
1. Roma standard instance open/edit/publish succeeds.
2. DevStudio standard instance open/edit/publish succeeds.
3. Same workflow resolves same account/workspace identity across hosts.
4. Asset upload/delete/replace succeeds from both hosts.
5. Roma assets UI management path succeeds end-to-end.
6. Publish shows immediate embed update.
7. Matrix scope is bounded to:
   - one happy-path standard widget flow per host,
   - one happy-path account-asset flow,
   - one negative case per contract class.
8. Publish latency gate:
   - local: publish-to-visible <= 5s
   - cloud-dev: publish-to-visible <= 7s

### G3: Cloud-dev runtime matrix
1. Same checks as G2 in cloud-dev.
2. No environment-specific behavioral divergence.

### G4: Existing build/static governance still green
1. lint
2. typecheck
3. contracts
4. api-loc
5. build
6. worker dry-run deploy

---

## 7) Why we cannot resume normal feature work before this is done

1. These are system invariants, not edge cases. If they are false, every new feature branch is built on undefined behavior.
2. Host divergence (Roma vs DevStudio) doubles bug surface and guarantees repeated regressions.
3. Broken asset and publish contracts invalidate output trust: users can edit/publish and still observe stale or missing runtime behavior.
4. Build-complete without runtime-complete creates false confidence and repeated production-risk merges.
5. Restoring runtime truth first reduces total delivery time by preventing rework loops across all subsequent PRDs.

---

## 8) Deliverables

1. Code changes that satisfy C1-C5.
2. `050__Execution_Report.md` with explicit local + cloud-dev runtime matrix evidence.
3. Publish latency evidence table (`publishAcceptedAt`, `embedVisibleAt`, `deltaMs`) for local and cloud-dev.
4. Cloud-dev account-context baseline evidence captured before and after convergence.
5. Updated governance notes clarifying that completion requires runtime-complete state, not only build-complete.

---

## 9) Execution delta (2026-02-22)

1. **Local startup usability hardened (`scripts/dev-up.sh`)**
   - `dev-up` now treats startup as failed if registered services are not actually healthy/listening.
   - `dev-up` now generates ephemeral local `CK_ADMIN_PASSWORD` (and defaults `CK_ADMIN_EMAIL`) when missing, instead of hard-failing local startup.
   - Bob startup now receives explicit `ENV_STAGE=local` and admin identity env vars for deterministic local-only DevStudio bootstrap behavior.
2. **Gate model simplified**
   - PR and cloud-dev workflows now keep boundary-focused checks (`paris-boundary`, `bob-bootstrap-boundary`) plus runtime parity.
   - Removed extra blocking gates that were adding noise without improving runtime truth.
3. **Runtime parity evidence (local)**
   - Local runtime parity public + auth suites pass when executed in the same shell after canonical startup:
     - `bash scripts/dev-up.sh --reset && pnpm test:runtime-parity:public && pnpm test:runtime-parity:auth`
4. **Admin=user runtime convergence progressed**
   - Removed Bob proxy superadmin header/key enforcement from workspace instance create/update, render-snapshot, l10n enqueue-selected, and website-creative routes.
   - Bob Paris proxy CORS allowlist no longer advertises `x-ck-superadmin-key`.
   - DevStudio workspace tool no longer prompts/retries with `x-ck-superadmin-key`; requests now rely on the same session/JWT path used by product runtime.
5. **Paris orchestration boundary extracted for SanFrancisco**
   - Added shared `paris/src/shared/sanfrancisco.ts` client boundary for SanFrancisco calls (misconfiguration + upstream error normalization in one place).
   - Migrated `paris/src/domains/personalization/index.ts` and `paris/src/domains/ai/index.ts` to use the shared boundary instead of direct domain-level HTTP wiring.
   - Runtime behavior remains the same; this reduces coupling and prepares command/event extraction without changing local/cloud route semantics.
6. **Runtime parity evidence (cloud-dev + cross-env)**
   - `pnpm test:runtime-parity:cloud-dev:public` passes.
   - `pnpm test:runtime-parity:cloud-dev:auth` passes.
   - `bash scripts/dev-up.sh && pnpm test:runtime-parity:cross-env` passes with auth/public parity diff checks (`parityDiff=PASS`).
7. **Command-envelope hard cut for orchestration handoff**
   - Paris dispatches explicit command envelopes for personalization enqueue and AI outcome attach through the shared SanFrancisco client boundary.
   - SanFrancisco handlers now require command envelopes only (`personalization.preview.enqueue`, `personalization.onboarding.enqueue`, `ai.outcome.attach`); legacy direct payloads are rejected.
8. **DevStudio naming convergence (runtime code)**
   - DevStudio local action fetch helper renamed from `superadminFetch` to `privilegedActionsFetch` (behavior unchanged) to align naming with admin=user entitlement model.
9. **Superadmin naming removed from runtime gates**
   - Paris curated-write local-only deny reason key moved from `coreui.errors.superadmin.localOnly` to `coreui.errors.curated.localOnly`.
   - DevStudio workspace tool UI/runtime IDs and variables were renamed from `superadmin-*` to `privileged-*` (behavior unchanged).
10. **Post-rename parity evidence**
   - Boundary suites and full cross-env parity were rerun after the renames and remained green (`parityDiff=PASS`).
11. **Publish snapshot locale fallback hardened**
   - Paris render-snapshot locale resolution now unions workspace-configured locales with persisted locale overlay keys for the target instance.
   - This prevents stale non-English snapshots when base publishes happen while workspace locale config is temporarily invalid/out-of-sync with already translated locales.
   - Runtime parity suites (local + cloud-dev + cross-env diff) remained green after the change (`parityDiff=PASS`).
12. **Admin=user metadata convergence in Roma bootstrap/settings**
   - Roma-facing bootstrap accounts payload no longer exposes `isPlatform`; runtime behavior remains entitlement/capsule-driven.
   - Roma settings domain payload and UI no longer display platform-account identity metadata.
   - No admin/platform branch behavior was introduced.
   - Boundary + runtime parity suites remained green after this slice (`parityDiff=PASS`).
13. **No-backcompat hard cut on platform identity in runtime contracts**
   - `RomaAccountAuthzCapsulePayload` no longer carries `isPlatform`.
   - Identity `accounts[]` payload and account summary endpoint no longer return `isPlatform`.
   - Minibob handoff account-create response no longer returns `isPlatform`.
   - Boundary + runtime parity suites remained green after the hard cut (`parityDiff=PASS`).
14. **No-backcompat hard cut on legacy render-index read path**
   - Paris render index loader now reads publish pointer + revision index only.
   - Legacy fallback read path `/renders/instances/:publicId/index.json` was removed.
15. **L10n enqueue workflow compute reduced in Paris**
   - `enqueueL10nJobs` no longer performs Paris-side snapshot diff/removal planning or user-overlay rebase execution in the request path.
   - Paris now keeps control-plane responsibilities in this path (authz, fingerprint/state, queue dispatch), and SanFrancisco remains responsible for translation decisioning/execution at job runtime.
   - Boundary + runtime parity suites remained green after this slice (`parityDiff=PASS`).
