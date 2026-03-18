# PRD 073 — Audit-Driven Architecture Upleveling and Simplification

Status: COMPLETE
Date: 2026-03-18
Owner: Product Dev Team
Priority: P0 (operational readiness + simplification)
Depends on:
- `070A__PRD__Product_Boundary_Closure.md`
- `072__PRD__Roma_Boring_SaaS_Shell__Current_Account_Truth_And_Direct_Product_Flows.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`

Audit inputs:
- `clickeen-4-tenet-audit.pdf` (2026-03-17)
- Staff-engineer-level repo traversal audit provided inline by the human (2026-03-17)
- Executive-view / blast-radius / scale-risk audit provided inline by the human (2026-03-17)

---

## One-line objective

Turn valid architecture-audit findings into one disciplined execution track that:
- hardens Clickeen for boring PLG-scale operation
- removes remaining high-cost code complexity
- preserves the closed product boundaries from PRD 070A/072
- rejects audit recommendations that would reintroduce duplication, wrappers, or enterprise sludge

---

## Core premise

The audit is useful because it confirms the broad direction of the recent refactor:
- Paris is no longer a product-domain dumping ground
- Roma is the boring SaaS shell and product backend
- Berlin is auth/session truth
- Tokyo/Tokyo-worker own saved-config, asset, localization-artifact, and live-surface execution truth
- Cloudflare-native infrastructure gives the system a strong scaling base

But audits are snapshots, not specs.

The current audit set includes:
- Audit 01: the Four Tenets PDF taken against commit `152a73ee`
- Audit 02: a broader staff-engineer-level repo traversal supplied after the first PRD 073 draft
- Audit 03: an executive-view / blast-radius / scale-risk audit supplied after the second PRD 073 update

PRD 073 exists because audit-driven work must be normalized before execution:
- some findings remain fully valid
- some findings are already stale because the architecture moved
- some findings are directionally right but recommend the wrong implementation style
- some findings would violate Clickeen tenets if implemented literally

This PRD is therefore the canonical execution track for audit-derived changes.
Audits feed this PRD.
Audits do not bypass it.

---

## Execution progress

Completed slices so far:
- Phase 0 DevStudio reduction:
  - removed `http://localhost:5173/#/tools/dev-widget-workspace`
  - removed the dead local control-tool affordances tied to that lane
- operational floor:
  - Berlin auth/session mutation rate limiting and structured request logging
  - Roma account-mode mutation rate limiting and structured request logging
  - Cloudflare-native observability is now the boring first production sink across the active server plane (`berlin`, `roma`, `tokyo-worker`, `sanfrancisco`)
- scale correctness:
  - Berlin membership/member/invitation read paths no longer rely on silent `500/1000` truncation
  - Roma/Michael widget/template/assets list surfaces now iterate service-side pages so caller truth is complete without hidden client caps
  - authenticated wildcard CORS drift removed from Roma asset upload
- simplification:
  - Berlin connector scaffolding reduced to real linked-identity truth
  - shared account locale-policy validation moved into `@clickeen/ck-contracts`
  - Tokyo-worker now owns the public MiniBob instance payload assembly; Venice is a thin public proxy for that route
  - Tokyo-worker internal/account-scoped routes no longer inherit wildcard CORS; Tokyo now emits request ids and structured completion logs like Berlin/Roma
  - Roma now mounts explicit client-side error boundaries across domain-shell and Builder surfaces
  - `roma/lib/michael.ts` is split into boring domain modules behind a thin barrel
  - `tokyo-worker/src/domains/account-localization.ts` is split into smaller Tokyo-owned modules behind the same owner boundary
  - Roma account-budget reads now take `USAGE_KV` explicitly from the request boundary instead of ambient global context in the hot product path
- the first `Berlin -> Roma -> Tokyo-worker -> Venice` contract-test floor exists, is wired into root `pnpm test`, and now includes a real Venice -> Tokyo-worker route contract for the public instance payload seam
- verification floor expansion:
  - Berlin large-account pagination contract coverage
  - Berlin session-plane contract coverage for refresh convergence, replay revocation, and logout scope semantics
  - Tokyo saved-config -> canonical l10n fingerprint contract coverage
  - Roma publish/live rollback contract coverage
  - AI grant/budget/provider/concurrency contract coverage
- explicit account-scale DB audit:
  - active `account_id` RLS predicate tables and account-scoped high-volume tables were audited against the current migrations/runtime path
  - existing indexes already satisfy the active product-path floor; no new migration was required
- runtime assumption closure:
  - Berlin now explicitly documents the Cloudflare Workers isolate assumption where `globalThis` signing/HMAC caches remain in use
- final-pass closure:
  - `tokyo-worker/src/index.ts` is now a small request shell + queue handoff; the remaining route families live in owner-correct route modules and dispatch
  - the contract floor now explicitly covers Tokyo asset lifecycle and explicit Tokyo l10n sync / ready truth
  - Roma rate limiting now takes `USAGE_KV` explicitly from the request boundary instead of reading it inside the generic request-ops layer
  - `roma/lib/cloudflare-request-context.ts` is retained only for narrow edge-only binding/stage reads and now documents that boundary explicitly
  - stale Paris/top-level owner-role drift is corrected in the canonical architecture docs
  - root `.tmp/` residue is removed from versioned repo state
  - Venice locale-selection/runtime helper logic is deduped behind one shared source for the public shell and v2 loader

The accepted architectural direction is executed and the final-pass closure track is complete.
No remaining open items are required to satisfy PRD 073's accepted scope.
Further reduction work stays valid only as future follow-up when it deletes real complexity without reopening owner boundaries.

---

## Closure plan

Executed in the final pass on 2026-03-18.

PRD 073 closes only through a **final-pass reduction and truth-alignment track**.

This is not a new architecture phase.
It is the last boring pass that ensures the PRD, the code, the docs, and the verification floor all say the same true thing.

### Closure objectives

1. Keep the current owner boundaries intact.
   - Berlin remains auth/session truth.
   - Roma remains product shell and product backend.
   - Tokyo/Tokyo-worker remain saved/live/localization/public-payload truth.
   - Venice remains a thin public runtime consumer.

2. Close only the remaining high-blast-radius truth gaps.
   - no reopened product-boundary debate
   - no new control plane
   - no generic framework creation
   - no speculative infrastructure migration

3. Reduce code and delete stale LOC where the remaining criteria still overclaim.
   - final reduction is valid only when it makes a hotspot more legible or deletes duplicate/stale logic
   - cosmetic churn is out of contract

### Closure slices

#### Slice C1 — Tokyo entrypoint final reduction

Owner: `tokyo-worker`

Problem:
- `tokyo-worker/src/index.ts` is materially improved, but it is still too large to honestly call “a boring route-entry shape.”

Required closure move:
- extract the remaining route families/handler bodies that still keep `tokyo-worker/src/index.ts` as a mega-router
- leave `index.ts` as request shell + route dispatch + queue entry only

Rules:
- no routing framework
- no new abstraction layer between the entrypoint and Tokyo domain owners
- extraction must delete inline route logic, not wrap it

Done means:
- `tokyo-worker/src/index.ts` is readable as a router in one pass
- auth, parsing, and response shaping for route families live with the owning domain or route group

#### Slice C2 — Verification truth alignment

Owner: root contract floor + owning services

Problem:
- the current contract suite is good, but PRD 073 currently overstates it as broader “integration coverage” than the repo actually has
- the PRD worklist also names specific seams that must not be implied complete unless they are actually covered

Required closure move:
- add the missing highest-value contract tests for the still-named product seams:
  - asset lifecycle
  - explicit l10n sync / ready truth
- keep the existing Berlin -> Roma -> Tokyo-worker -> Venice continuity contract floor
- tighten PRD language so it accurately describes the verification floor as a contract floor, not a fake full-stack integration story

Rules:
- no spun-up multi-service test harness
- no vendor test platform
- no mock-heavy test described as end-to-end integration

Done means:
- the missing named seams are covered, or the PRD no longer claims they are
- the verification wording matches the repo exactly

#### Slice C3 — Final ambient-context reduction only where it deletes real indirection

Owner: `roma`

Problem:
- the hot-path budget usage issue is fixed, but `roma/lib/cloudflare-request-context.ts` still exists as an ambient-context escape hatch in a few places

Required closure move:
- reduce or eliminate remaining ambient-context reads only where the call-site plumbing stays simpler than the indirection
- if a remaining usage is still the cleanest local choice, document it and stop

Rules:
- no wrapper-on-wrapper refactor
- no “purity” churn that adds more parameters everywhere without deleting real complexity

Done means:
- either the remaining product-path uses are removed
- or the file is explicitly retained with narrow rationale and no open ambiguity

#### Slice C4 — Closure truth, stale-LOC deletion, and honest completion

Owner: PRD + service owners

Problem:
- PRD 073 should not close on optimistic wording

Required closure move:
- delete stale helper code, stale doc claims, and stale success-language that no longer matches the repo
- update the PRD status to `COMPLETE` only after the final-pass slices above are actually closed

Rules:
- no “close now, clean later”
- docs and verification updates land in the same slice as the behavior/ownership change

Done means:
- no known active-runtime duplicate path remains from PRD 073 work
- no success criterion overclaims beyond what the repo currently proves

---

## What this PRD is and is not

This PRD is:
- an audit-intake and execution PRD
- an operational-readiness PRD
- a simplification PRD
- a scale-correctness PRD
- a delete-and-reduce PRD wherever the current code is too large or too duplicated

This PRD is not:
- a generic SRE platform initiative
- a vendor-shopping exercise
- a reopen-Paris exercise
- a second policy-engine exercise inside Tokyo-worker
- a broad testing crusade disconnected from critical product paths
- a justification for new wrapper layers, abstract frameworks, or speculative infrastructure

If a finding requires more code, more concepts, and more ownership ambiguity than the problem itself, it is out of contract for PRD 073.

---

## Execution posture

PRD 073 must be executed as a **reduction-and-hardening** track, not as an accumulation track.

This is the core anti-drift rule:
- every accepted change must make the active system more boring, more owner-correct, or more operationally trustworthy
- if a change only adds new layers, new helpers, or new framework shape around the same problem, it is not valid PRD 073 execution

Required execution posture:
- land vertical slices, not broad speculative refactors
- move behavior to the correct owner and delete the old path in the same slice whenever feasible
- update runtime docs in the same slice when behavior or ownership changes
- normalize stale audit claims before acting on them
- prefer platform-native mechanisms before writing new infrastructure code
- treat deletion of duplicate code, stale helpers, stale docs, and stale routes as part of functional completion

Forbidden execution posture:
- keeping old and new paths alive “for now”
- adding wrapper layers around the wrong owner instead of moving the behavior
- creating a generic shared framework before there are at least two real owner-correct callers
- using tests to preserve obsolete behavior that this PRD is intentionally deleting
- broad taxonomy churn, service renames, or platform rewrites justified only by audit language
- adding new AI-plane sophistication before the verification floor for the existing AI plane is in place

If a proposed implementation cannot explain:
1. who the single owner is
2. what old code gets deleted
3. what docs are updated
4. what test or verification closes the slice

then it is not ready to execute under PRD 073.

---

## Non-negotiable truths

### Truth 0: audits do not override architecture

PRD 070A and PRD 072 already closed key ownership questions.
PRD 073 must strengthen that architecture, not reopen it.

Still closed:
- Roma is the product shell and product backend
- Berlin is auth/session truth
- Tokyo/Tokyo-worker own saved-config/artifact/live execution truth
- San Francisco runs AI
- Paris is not a normal product-path owner

### Truth 1: boring platform-native solutions win

Where Cloudflare or the existing runtime already gives us a simple, durable mechanism, use that first.

Examples:
- rate limiting should prefer Cloudflare-native enforcement or a minimal shared limiter
- observability should start with structured logs plus one boring sink
- request tracing should be additive, not a new internal telemetry platform

PRD 073 must not create an internal platform project where one platform feature or one shared utility solves the actual need.

### Truth 2: scale correctness matters more than scale theater

Clickeen is PLG.
“Free users at volume” is not edge traffic we can ignore.

Therefore PRD 073 prioritizes the things that actually break real scale:
- unbounded or unthrottled mutation paths
- no operational visibility when production goes wrong
- silent truncation in list/catalog flows
- UI crashes that take down the whole workspace
- no tests around critical money-path / content-path / publish-path flows

This PRD is not allowed to mistake framework complexity for production readiness.

### Truth 3: simplification is part of the functional work

If a file is too large, too duplicated, or too mixed in responsibility, shrinking or splitting it is not “cleanup later.”
It is part of making the architecture trustworthy for humans and AIs.

PRD 073 therefore includes targeted code reduction work where the current shape is still too costly:
- `roma/lib/michael.ts`
- `berlin/src/account-state.ts`
- `tokyo-worker/src/index.ts`
- `tokyo-worker/src/domains/account-localization.ts`
- repeated shared primitives like `isRecord()`

### Truth 4: internal systems do not re-gate already-minted truth

The audit correctly asks for stronger operational hardening.
It does not justify duplicating business authority across owner boundaries.

Therefore:
- Tokyo-worker should not become a second entitlements engine for normal Roma-owned product writes
- observability must not become a second control plane
- tests must validate the intended owner contract, not institutionalize wrong fallback behavior

### Truth 5: future audits enter through normalization, not copy-paste

Every future audit that feeds PRD 073 must be normalized into one of four buckets:
1. `valid-now / in-scope`
2. `valid-now / backlog`
3. `stale because architecture already moved`
4. `rejected because it conflicts with architecture or tenets`

PRD 073 must remain the place where that normalization is made explicit.

---

## Audit register

| Audit | Date | Status | Notes |
|---|---|---|---|
| `clickeen-4-tenet-audit.pdf` | 2026-03-17 | normalized into PRD 073 | Useful overall direction; contains stale references to pre-cleanup save/l10n files and must not be executed literally |
| Staff-engineer-level repo traversal audit (human-provided) | 2026-03-17 | normalized into PRD 073 | Adds valid Berlin/session/scale/hygiene findings; also contains several recommendations that would create churn or reopen already-closed architecture decisions if followed literally |
| Executive-view / blast-radius / scale-risk audit (human-provided) | 2026-03-17 | normalized into PRD 073 | Reinforces the need to collapse remaining duplicated orchestration, harden account-scale reads, and add contract tests before more AI/system complexity lands |

---

## Normalized findings from Audit 01

### Valid and in scope now

1. Roma mutation routes need real rate limiting.
2. Server-side request logging and production observability are too weak.
3. Critical customer flows have too little test coverage.
4. Catalog/listing flows still contain hard truncation risk.
5. Roma needs explicit client-side error boundaries.
6. `roma/lib/michael.ts` is still too large and too mixed.
7. `isRecord()` is duplicated excessively across the monorepo.
8. `tokyo-worker/src/index.ts` is too large and route-heavy.
9. `tokyo-worker/src/domains/account-localization.ts` is now the correct owner, but still too large and should be split.

### Valid directionally, but the audit’s concrete recommendation must change

1. “Add observability / APM” is valid, but the first move should be boring structured logs plus one standard sink, not a sprawling vendor-led telemetry framework.
2. “Extract `resolveTokyoControlErrorDetail()`” is valid, but only within Roma-side Tokyo control clients. Do not build a fake cross-owner shared abstraction between Roma and Tokyo-worker.
3. “Write tests for save aftermath” is stale language. The real contract now is:
   - direct save to Tokyo as the save boundary
   - explicit Tokyo-worker sync for localization/live convergence
   - tests must target that real architecture

### Stale because the architecture already moved

1. `roma/lib/account-save-aftermath.ts` is gone and must not come back.
2. `roma/lib/account-l10n.ts` is no longer the large mixed owner the audit described.
3. Save no longer owns l10n/live orchestration in Roma.

### Rejected as written

1. “Add defense-in-depth budget checks in Tokyo-worker” is rejected as a normal-path requirement.
   - For the intended product path, Roma remains the entitlement/policy gate for account operations.
   - Tokyo-worker is not allowed to become a second product-policy engine by accident.
   - If a future non-Roma product-write path is introduced, that can open a separate PRD.

---

## Normalized findings from Audit 02

### Valid and in scope now

1. Berlin auth/session routes need the same operational floor as Roma:
   - real rate limiting
   - structured logging
   - useful server-side observability

2. Berlin account-state and member-listing paths still contain scale-incorrect hidden caps and bulky query shapes:
   - `loadAccountMembershipRows()` uses `limit: '1000'`
   - `listAccountMembers()` uses `limit: '500'`
   - `loadUserProfilesByIds()` builds a large `in.(...)` profile query shape

3. Repo hygiene drift is real and should be cleaned as part of simplification:
   - root `repro_fetch.mjs`
   - empty root `Hue`
   - committed `.tmp/`

4. `berlin/src/account-state.ts` still contains overbuilt constant-value connector/capability scaffolding that should be reduced until the product has real differentiated states.

5. Inline locale-policy validation in `berlin/src/account-state.ts` should move to shared contracts instead of remaining as hand-written structural validation inside the auth/account-state loader.

6. Wildcard CORS usage must be explicitly constrained to intentional public, stub, or local-tool surfaces and audited anywhere authenticated or account-scoped data is involved.

7. Account-scale RLS/index coverage needs an explicit audit for `account_id`-driven tables used on the active product path.

### Valid directionally, but the audit’s concrete recommendation must change

1. “Durable Objects-backed session store” is a valid risk signal, but the real requirement is a Berlin session-plane scale/correctness review.
   - Do not pre-commit to a store migration without first proving the required refresh-rotation/logout semantics and showing that KV cannot satisfy them.

2. “Paris is under-built relative to the architecture map” is directionally a docs-truth issue, not a reason to grow Paris again.
   - The fix is documentation truth and service-role clarity, not re-expanding Paris into a product-path owner.

3. “Bob compile path has no caching” overstates the current implementation.
   - Bob already has an in-memory compiled widget cache on the compiled route.
   - The real task is to make compile/runtime caching strategy explicit and sufficient, not to pretend there is currently zero caching.

4. “`minibob` mixed into the production entitlements matrix” is a valid containment concern, but the true requirement is that internal/test profiles cannot leak through normal customer assignment paths.
   - That does not automatically require forking the matrix in the first move.

5. “`globalThis` signing cache is a portability risk” is only material if runtime portability becomes an actual goal.
   - The immediate fix is to document the Cloudflare-isolate assumption clearly if the cache remains.

### Stale because the architecture or narrative already moved

1. The audit’s architecture map still describes Paris as an identity/policy/instance-data API.
   - That is stale for the active product path after PRD 070A/072.

2. The audit’s Bob “precompiled” critique is partly documentation drift, not a fresh architecture finding.
   - The current code already exposes explicit compiled widget routes and per-isolate compiled caching.

### Rejected as written

1. Repo-wide renaming of city-named services to descriptive names is rejected.
   - The naming convention is already embedded across code, docs, and product language.
   - A repo-wide rename would create more churn and drift risk than product value.
   - PRD 073 is for operational readiness and simplification of real behavior, not mass taxonomy churn.

---

## Normalized findings from Audit 03

### Valid and in scope now

1. Pagination and read-scaling are still not SaaS-ready across several account paths.
   - Hard caps are already captured for Michael and Berlin flows.
   - Builder/assets/invitations/account-member/catalog paths need to converge on real scalable read contracts, not hidden truncation.

2. High-level documentation drift remains a repo-level P0 where runtime has moved to Tokyo-saved authoring truth but some docs still describe older Paris/Michael-centric behavior.

3. DevStudio still carries too much backend and localization orchestration inside `admin/vite/devstudio.ts`.
   - The first concrete DevStudio reduction in PRD 073 is eliminating the local widget-authoring workspace at `http://localhost:5173/#/tools/dev-widget-workspace`.
   - This is **not** a deprecation of DevStudio as a whole.

4. Venice public-instance payload assembly still duplicates localization/base-fingerprint/overlay work that should live once at the real server owner.

5. `roma/lib/michael.ts` remains a maintenance hotspot and should still be reduced.

6. Contract tests across the Berlin -> Roma -> Tokyo-worker -> Venice chain are now required.
   - The architecture is strong enough that the biggest current risk is drift between owners.

7. The AI plane is more sophisticated than the surrounding verification surface justifies today.
   - Grant minting, provider routing, concurrency, and copilot heuristics need explicit contract/budget coverage before further sophistication is added.

### Valid directionally, but the audit’s concrete recommendation must change

1. “Collapse duplicated localization/public-payload assembly into one shared server library” is directionally correct, but the implementation must stay owner-correct.
   - The fix is not a new universal cross-runtime kitchen-sink library.
   - The fix is to move the shared assembly behind Tokyo-owned server primitives or a shared server-side implementation used by the thin callers that truly need it.

2. “Introduce materialized read paths” is valid as a possible later optimization, but the first move is boring pagination and safe query shapes.
   - Materialization should be added only where the real read pattern proves it is needed.

3. “Do three things before touching more AI sophistication” is directionally right.
   - The immediate PRD 073 implication is containment: no meaningful new AI-plane complexity until grant/budget/provider contract tests exist.

### Stale because the architecture already moved

1. The audit’s Roma localization-assembly criticism is partly stale.
   - `roma/lib/account-l10n.ts` is no longer the old orchestration engine.
   - The active duplication problem is now mostly DevStudio + Venice, not the former Roma aftermath/l10n path.

2. The audit’s reference to `account-live-surface.ts` is stale.
   - That Roma-owned live-surface helper was removed in the boundary cleanup.

### Rejected as written

1. A generic “shared library everywhere” response is rejected if it creates a new abstraction layer detached from the real owner.
   - PRD 073 only accepts deduplication that clarifies ownership instead of flattening it.

---

## The problem this PRD solves

After the large boundary cleanup, the remaining problems are no longer “who owns this?”
They are:
- how do we make the current architecture operationally trustworthy?
- how do we remove the remaining heavy files and duplicate primitives that still slow humans and AIs down?
- how do we harden the system for PLG-scale usage without turning it into enterprise ceremony?

That is the exact job of PRD 073.

The target state is simple:
- customer mutations are bounded and rate-limited
- auth/session and account membership paths are bounded and scale-correct
- production requests are observable
- failure isolation exists in the client
- critical flows are tested
- duplicated orchestration is collapsed behind the right server owner
- AI cost/throughput logic is contained by explicit contract tests before further complexity grows
- large mixed files are reduced into boring domain modules
- repo and docs truth stay free of stale scaffolding artifacts
- audit-driven work improves the existing architecture instead of reopening it

---

## Execution order and closure rules

The execution order in this PRD is intentional.

Default order:
0. remove the DevStudio local widget-authoring workspace at `http://localhost:5173/#/tools/dev-widget-workspace`
1. operational floor
2. scale correctness
3. verification floor
4. code reduction and owner-shape cleanup

Execution may interleave where a slice is tightly coupled, but these rules are mandatory:

1. No code-reduction slice is complete if it only extracts code without deleting the superseded implementation.
2. No owner-boundary deduplication slice is complete if DevStudio/Venice/Roma/Tokyo all still carry the same assembly logic afterward.
3. No route-contract change is complete until callers, docs, and verification are updated together.
4. No audit finding may be “half accepted”; if it is not being executed, it must be marked backlog, stale, or rejected in this PRD.
5. No AI-plane sophistication work should expand meaningfully until the AI contract/budget/concurrency verification item in this PRD is complete.
6. The DevStudio workspace deletion slice must land before broader DevStudio/Venice deduplication work, so the rest of the PRD executes against the smaller post-deprecation surface.

Definition of closure for each completed slice:
- the intended owner is unambiguous
- old duplicate code is removed or explicitly demoted to backlog with a reason
- obsolete docs/contracts are deleted or corrected
- verification exists at the right level for the risk of the slice

This PRD should trend toward net simplification in the touched area.
If a slice increases touched-area complexity without removing more complexity than it adds, stop and redesign it.

---

## Execution slices

### Slice A — Operational floor

Goal:
- make production failures and abuse visible and bounded

Scope:
- rate limiting
- structured request logging
- error tracking / log shipping
- CORS surface audit where wildcard use exists today

Primary code vectors:
- `roma/app/api/account/**`
- `roma/middleware.ts`
- `roma/lib/**` request-context helpers
- `berlin/src/**` auth/session handlers where request correlation should continue
- `tokyo-worker/src/index.ts` and private control endpoints for request correlation/logging
- Cloudflare config where platform-native enforcement is preferred

Blast radius:
- all normal account-mode mutation/read routes
- Berlin auth/session routes
- no product semantics should change
- server-side behavior only

Simple/boring contract:
- use one shared request logger shape
- prefer one platform-native rate-limit mechanism
- do not create a custom telemetry platform

### Slice B — Scale-correctness fixes

Goal:
- remove silent truncation and other hidden “works until power users arrive” failures

Scope:
- replace hard listing limits with deliberate service-side paging or bounded caller contracts
- remove large-account query shapes that fail by URL size or hidden fanout
- define the intended Berlin session-plane consistency contract under scale
- audit RLS predicate index coverage for account-scaled tables

Primary code vectors:
- `roma/lib/michael.ts`
- `berlin/src/account-state.ts`
- `berlin/src/account-members.ts`
- `berlin/src/routes-account.ts`
- `berlin/src/routes-session.ts`
- `berlin/src/session-kv.ts`
- `supabase/migrations/**`
- catalog/listing routes under `roma/app/api/account/**`
- Roma workspace components consuming widget/template lists

Blast radius:
- account widget/template/library listing behavior
- account membership/team list behavior
- session rotation/logout semantics if the session plane changes
- request/response shape for list routes

Simple/boring contract:
- one explicit listing-truth model
- service-side page iteration first; caller-visible pagination only when the product UI actually needs it
- no hidden truncation
- no tier logic leaking into route shape
- no giant URL fanout queries as the normal large-account path

### Slice C — Failure containment in Roma UI

Goal:
- prevent one client-side exception from crashing the whole workspace

Scope:
- top-level Roma shell boundaries
- domain-level boundaries where builder/assets/team/settings are isolated enough to fail independently

Primary code vectors:
- `roma/app/**`
- `roma/components/**`

Blast radius:
- client rendering only
- no server behavior changes

Simple/boring contract:
- one clear top-level boundary
- targeted domain boundaries where they materially isolate failure
- no error-boundary maze

### Slice D — Critical-path verification

Goal:
- give the active architecture enough test coverage that regressions are caught before runtime

Scope:
- account bootstrap / auth capsule path
- asset upload -> resolve -> delete lifecycle
- save direct-to-Tokyo boundary
- localization desired -> ready status and explicit sync
- publish/live containment where still on the active product path

Primary code vectors:
- targeted app and library integration tests near Roma/Tokyo-worker boundaries

Blast radius:
- CI and local verification
- no production behavior change

Simple/boring contract:
- test the real business-critical flows
- do not create a general testing initiative
- do not preserve obsolete architecture in test fixtures

### Slice E — Code reduction and owner-shape cleanup

Goal:
- remove the remaining large-file and duplication tax that still makes the codebase harder to modify than it should be

Scope:
- split `roma/lib/michael.ts` by domain
- reduce `berlin/src/account-state.ts`
- reduce `admin/vite/devstudio.ts`
- reduce `tokyo-worker/src/index.ts` by extracting route handlers
- reduce and split `tokyo-worker/src/domains/account-localization.ts`
- reduce duplicated localization/public-payload assembly in Venice/DevStudio by moving it behind owner-correct server primitives
- reduce Venice loader/public-runtime maintainability hotspots
- extract shared low-level primitives where duplication is purely mechanical
- remove root and repo drift artifacts that should not survive on main

Primary code vectors:
- `roma/lib/michael.ts`
- `berlin/src/account-state.ts`
- `admin/vite/devstudio.ts`
- `tokyo-worker/src/index.ts`
- `tokyo-worker/src/domains/account-localization.ts`
- `venice/app/api/instance/[publicId]/route.ts`
- `venice/app/embed/v2/loader.ts`
- shared contract/util packages where extraction is truly cross-cutting
- repo root and supporting docs where stale artifacts or stale role descriptions remain

Blast radius:
- moderate, but should be mostly internal refactor with stable route contracts
- high AI/human maintainability impact

Simple/boring contract:
- split by ownership and domain responsibility
- avoid abstraction frameworks
- prefer smaller direct modules over one “shared engine”
- duplicated assembly should live once at the real server owner, not once per orchestrator

---

## Detailed worklist

### Phase 0 — DevStudio workspace deprecation

0. Remove the local DevStudio widget-authoring workspace at `http://localhost:5173/#/tools/dev-widget-workspace`.
   - Delete the route/tooling/backend logic that exists only to support this local workspace path.
   - Remove or correct docs that imply this path remains part of the active toolbench contract.
   - This is **not** removal of DevStudio as an internal toolbench.
   - Later PRD 073 DevStudio reduction work assumes this path no longer exists.

### Phase 1 — Rate limiting and observability

1. Add real rate limiting for account-mode and Berlin auth/session routes.
   - Prefer Cloudflare-native controls first.
   - If code is required, keep it minimal and shared.
   - Do not create per-route bespoke rate-limit logic.

2. Add a shared structured request logger.
   - Required fields: request ID, account ID when present, route/operation, status, latency.
   - Use one JSON shape across Roma, Berlin, and Tokyo-worker where practical.

3. Add one boring production observability sink.
   - Acceptable first moves: Workers Logpush, Sentry, or a similarly minimal standard path.
   - Not acceptable: a custom internal observability platform.

4. Audit wildcard CORS usage and constrain it to intentional surfaces only.
   - Public/local-tool/stub routes may stay permissive when explicitly justified.
   - Authenticated or account-scoped routes must not inherit wildcard CORS by drift.

### Phase 2 — Scale correctness

5. Remove hard-coded truncation in Michael-backed listing paths.
   - Replace `limit=500`-style hidden caps with explicit service-side page iteration.
   - Keep the caller contract boring unless/until a real user-facing paginated UX is required.

6. Remove hard-coded truncation and unsafe large-account query shapes in Berlin account-state/member flows.
   - Replace `limit=1000` / `limit=500` hidden caps with explicit service-side page iteration.
   - Replace large `in.(...)` profile fanout with a large-account-safe read path.

7. Define and harden the Berlin session-plane scale contract.
   - Make refresh rotation, logout, revoke, and high-concurrency semantics explicit.
   - Keep KV only if it satisfies the intended contract.
   - If it does not, choose the smallest owner-correct change; do not pre-commit to a migration shape before that review.

8. Audit and fix RLS/index coverage for account-scaled tables where policy predicates rely on `account_id`.

9. Add explicit React error boundaries in Roma.
   - The workspace must degrade by domain, not crash wholesale.

### Phase 3 — Verification floor

10. Add targeted contract coverage for the current product architecture.
   - bootstrap/account authz capsule
   - asset lifecycle
   - direct save to Tokyo
   - explicit l10n sync / ready truth
   - publish/live containment where applicable
   - Berlin account membership/member-list scale contracts where logic changes
   - Berlin -> Roma -> Tokyo-worker -> Venice contract continuity

11. Add missing developer-operability docs only where they reduce real friction.
   - `.env.example`
   - debugger hookup notes
   - contributor/setup clarity
   - correct any stale service-role or compile-path narrative that no longer matches runtime truth

### Phase 4 — Simplification and file reduction

12. Split `roma/lib/michael.ts` by domain responsibility.
   - Expected first cuts:
     - `michael-catalog.ts`
     - `michael-instances.ts`
     - `michael-curated.ts`
     - `michael-team.ts` or equivalent boring domain grouping

13. Reduce `berlin/src/account-state.ts`.
   - Collapse constant-value connector/capability scaffolding until the product has real differentiated states.
   - Move locale/account-state structural validation into shared contracts where it belongs.

14. Extract shared `isRecord()` to one real shared primitive.
   - Prefer an existing low-level package such as `@clickeen/ck-contracts`.
   - Only do this if the resulting import shape stays boring.

15. Collapse Roma-side Tokyo control error parsing into one shared Roma helper.
   - This is a Roma cleanup only.
   - Do not couple Roma and Tokyo-worker through fake shared error abstractions.

16. Reduce `tokyo-worker/src/index.ts`.
   - Extract the remaining route groups/handlers so the entry file becomes an honestly boring router, not a second god object.

17. Reduce and split `tokyo-worker/src/domains/account-localization.ts`.
   - This is the promoted follow-up to the prior backlog item.
   - The owner boundary is now correct; the remaining work is to make the implementation smaller and more legible.
   - Split by real Tokyo-side responsibilities, not by arbitrary helper categories.

18. Clean repo and doc-truth drift artifacts that should not survive on main.
   - Remove or explicitly justify root debugging leftovers such as `repro_fetch.mjs`.
   - Remove empty or unexplained placeholder files such as `Hue`.
   - Stop tracking `.tmp/` if it is only local/runtime residue, or explicitly document why it must remain versioned.
   - Correct stale top-level/service descriptions if they still imply old Paris/Bob roles.

19. Contain internal/test profile assignment such as `minibob`.
   - Normal customer/account flows must not be able to assign internal-only profiles accidentally.
   - The first move is containment and explicit assignment rules, not a speculative entitlements redesign.

20. Document the Cloudflare-isolate assumption where runtime caches rely on it.
   - If `globalThis` caching remains in the signing path, the runtime assumption must be explicit in code/docs.

21. Collapse duplicated localization/public-payload assembly behind owner-correct server code.
   - Prefer Tokyo-owned/shared server-side primitives for base fingerprint, ready-locale, overlay, and public payload assembly.
   - Reduce caller logic in DevStudio and Venice instead of creating a new abstraction layer with no clear owner.

22. Reduce `admin/vite/devstudio.ts`.
   - This happens after the `http://localhost:5173/#/tools/dev-widget-workspace` path is removed.
   - Split local-tool backend concerns out of the Vite plugin blob where possible.
   - Keep DevStudio as an internal toolbench, not a second hidden product backend.

23. Reduce Venice public-runtime hotspots.
   - Shrink payload assembly duplication in `venice/app/api/instance/[publicId]/route.ts`.
   - Reduce giant string-blob/runtime loader maintenance burden where the current embed loaders are too opaque.

24. Add AI-plane contract and budget tests before further sophistication lands.
   - Cover grant minting, provider/model routing boundaries, budget enforcement, and concurrency assumptions.
   - Use this to contain further `widgetCopilotCore` complexity until the verification floor catches up.

---

## Explicit non-goals

PRD 073 does not do any of these:
- deprecate or remove DevStudio as a whole
- reopen the Paris/product-path debate
- recreate save-time “aftermath” orchestration in Roma
- add a second budget/policy engine inside Tokyo-worker
- create a broad “testing all the things” initiative
- add speculative multi-account Roma behavior
- rename the city-named service topology across the repo
- add heavy enterprise observability or platform abstractions when a simple platform-native option is enough

---

## Success criteria

PRD 073 is complete only when all of the following are true:

1. Normal account-mode mutation routes and Berlin auth/session routes are bounded by real rate limiting.
2. Production request logs are structured, correlated, and actually useful.
3. There is one boring production observability path for server-side failures.
4. Wildcard CORS usage is limited to explicitly justified surfaces and is not drifting onto authenticated/account routes.
5. Roma listing/catalog routes and Berlin membership/member-list routes no longer silently truncate at hidden hard caps; they use complete caller truth (via explicit page iteration or an explicit page contract) and no longer rely on large-account-unsafe query shapes.
6. Berlin session storage/rotation semantics are explicit and hardened enough for the intended product scale contract.
7. Account-scaled RLS predicate columns have been audited and indexed where needed.
8. Roma has explicit client-side error boundaries for meaningful domain isolation.
9. The current product-path critical flows have a truthful contract-test floor, including the Berlin -> Roma -> Tokyo-worker -> Venice chain, and the specific seams named in this PRD are either covered or explicitly removed from scope.
10. `roma/lib/michael.ts` is no longer a god object.
11. `berlin/src/account-state.ts` is reduced and no longer carries overbuilt constant scaffolding or hand-written contract validation that belongs in shared packages.
12. The local DevStudio widget-authoring workspace at `http://localhost:5173/#/tools/dev-widget-workspace` is removed, while DevStudio itself remains the internal toolbench.
13. `admin/vite/devstudio.ts` is reduced and no longer acts like a hidden mini-backend blob for overlapping product logic.
14. `tokyo-worker/src/index.ts` is reduced to an honestly boring route-entry shape rather than a mega-router with large inline route-family logic.
15. `tokyo-worker/src/domains/account-localization.ts` is reduced/split into smaller Tokyo-owned modules.
16. Remaining duplicated localization/public-payload assembly in DevStudio/Venice has been collapsed behind the correct server owner.
17. AI grant/budget/provider/concurrency behavior has contract coverage before more AI-plane sophistication is added.
18. Repo root and top-level docs no longer carry unexplained debug/placeholder/stale-role artifacts.
19. Audit-driven code changes do not reopen closed owner boundaries or reintroduce deleted architectural mistakes.
20. Completed slices leave no intentional old+new duplicate path hanging in active runtime code.
21. Completed slices update docs and verification in the same change window instead of deferring truth alignment.

---

## Backlog and promotion notes

- `EB-009` in `EVERGREEN_BACKLOG.md` is promoted into PRD 073 as part of Phase 4.
- Future audit findings that are valid but not executed in PRD 073 should be added back to `EVERGREEN_BACKLOG.md` with explicit rationale.

---

## Why this PRD is simple and boring

Because it does not invent a new architecture.

It assumes the architecture is now mostly right and focuses on the remaining high-value work:
- operational floor
- scale correctness
- critical-path verification
- code reduction where the remaining files are still too large

That is exactly the right next step after the large owner-boundary cleanup.

PRD 073 is not a theory PRD.
It is the “make the current architecture trustworthy, debuggable, and easier to evolve” PRD.

The final-pass closure plan keeps that same posture:
- finish only the remaining high-blast-radius truth gaps
- reduce code where the remaining hotspots still overclaim simplicity
- delete stale LOC and stale wording in the same slice
- reject any closure work that needs a new framework, new owner, or speculative platform layer

If a proposed closure step adds more moving parts than it removes, it is not valid PRD 073 closure work.
