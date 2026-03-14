# PRD 069B — Widget Workspace Boundary Restoration And Bob Host Cleanup

Status: EXECUTING
Date: 2026-03-13
Owner: Product Dev Team
Priority: P0

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

Restore the correct boundary between `DevStudio`, `Roma`, `Bob`, and `Paris` for widget-instance loading/opening, then split the oversized DevStudio widget workspace into explicit modules so these mistakes stop recurring.

---

## Why this PRD exists

We now have two real failures around the same area:

1. `DevStudio` local was incorrectly wired into `Roma` customer routes for widget listing.
2. `DevStudio` still tries to open widget instances in `Bob` through customer account routes and gets `401`.
3. `Roma` builder/open flows are surfacing `403` on account-instance reads for some instance/account combinations and need exact boundary cleanup instead of guesswork.
4. The DevStudio widget workspace lives in one giant file:
   - [dev-widget-workspace.html](/Users/piero_macpro/code/VS/clickeen/admin/src/html/tools/dev-widget-workspace.html)
   - current size: 2360 LOC

This is not one random bug.

It is one boundary problem plus one code-shape problem:

1. wrong route family chosen for the host surface
2. too much host transport, instance loading, Bob handoff, and UI state jammed into one file
3. `admin/vite.config.ts` currently carries active DevStudio proxy/runtime boundary logic and therefore belongs to this PRD, not `69A`

PRD 069B exists to fix both properly.

---

## Non-negotiable architectural baseline

PRD 069B does **not** reopen any of these:

1. `DevStudio` is local-only internal toolbench.
2. `Roma` is the customer shell.
3. `Bob` is the editor kernel.
4. `Berlin` remains canonical account/product truth.
5. `Paris` remains the API/orchestration layer.
6. Customer account routes must continue to require customer auth semantics.
7. `DevStudio` must not pretend to be a Roma customer session.
8. `Bob` must not gain a fake trusted-dev bypass for product account routes.

If a proposed fix weakens those rules, it is wrong.

---

## Plain-language problem statement

Today the widget workspace is mixing three different jobs:

1. loading the list of instances
2. loading the selected instance envelope/localization
3. handing the selected instance into `Bob`

Those jobs do not all belong to the same route family.

Current breakage:

1. `DevStudio` instance list was using a `Roma` customer route
   - this was wrong because DevStudio is not a Roma customer session
   - the list path has already been corrected to an explicit internal route

2. `DevStudio` instance boot still uses `Bob` customer account routes
   - `GET /api/accounts/:accountId/instance/:publicId`
   - `GET /api/accounts/:accountId/instances/:publicId/localization`
   - those routes expect real customer auth and correctly reject DevStudio local

3. `Roma` builder/open uses the same account-instance read family, but some combinations are now returning `403`
   - this must be traced exactly and fixed at the real boundary
   - no auth weakening
   - no guessed bypasses

4. The current DevStudio workspace file is too large to reason about safely
   - route transport
   - selection state
   - compiled widget loading
   - Bob handoff
   - support-host behavior
   - mutation commands
   all live together in one 2360-line HTML tool

That is how wrong boundary decisions survived multiple passes.

---

## What this PRD will fix

### Problem 1 — DevStudio must stop using customer account routes for instance boot

`DevStudio` may load and open platform/curated/widget instances for internal authoring and support, but it must do so through explicit local-tool/internal transport.

It must **not** do this by calling Bob customer routes and hoping they accept local-tool authority.

Required correction:

1. define explicit DevStudio transport for:
   - instance core/envelope
   - instance localization
   - any other read needed to boot `Bob`
2. keep those routes explicit and narrow
3. keep Bob customer account routes unchanged
4. build the new internal read handlers on top of shared instance-loading logic, not a Tokyo-only shortcut
5. support both:
   - account-owned instances
   - curated/platform-owned instances
6. preserve the existing Bob envelope/localization contract exactly so the host fix does not create a new payload drift
7. enforce the same platform-account guard already used by the DevStudio list route; customer-account support work continues to use the dedicated support path, not this route

### Problem 2 — Roma builder/open `403` must be traced and corrected exactly

The current `403` in Roma account-instance reads must be resolved by identifying the exact mismatch:

1. wrong `accountId`
2. wrong `publicId`
3. wrong host route for curated/platform-owned instances
4. wrong ownership gate
5. wrong account-context propagation

This must be fixed precisely.

It must **not** be fixed by:

1. weakening auth capsule enforcement
2. broadening product account reads
3. pretending every curated instance belongs to every account
4. adding dev-only bypasses to product routes

Important scope rule:

1. the DevStudio local `401` fix is a separate slice from the Roma `403` fix
2. DevStudio route restoration must not be described as “fixing Roma”
3. Roma product-path correction happens only after the exact failing instance/account class is pinned down

### Problem 3 — Widget workspace must be split into explicit modules

The current DevStudio widget workspace is too large and mixes unrelated concerns.

It must be split so that these concerns are separate:

1. instance-list loading
2. instance-envelope loading
3. Bob host handoff
4. widget compile/cache loading
5. workspace UI state/rendering
6. local-tool API transport

This split is not cosmetic.

It is necessary to stop boundary mistakes from hiding inside one giant file.

### Problem 4 — `admin/vite.config.ts` must be owned and cleaned up inside this PRD

`admin/vite.config.ts` is not just a generic LOC offender.

It is part of the active DevStudio runtime boundary because it currently owns:

1. local-tool proxy routes
2. DevStudio-to-Paris transport
3. auth/env wiring for those routes

That means it cannot be split in a different PRD from the boundary fixes it serves.

Required correction:

1. `069B` owns all `admin/vite.config.ts` cleanup
2. `069A` must not execute or block on this file
3. once the route surface is stabilized in `069B`, this PRD performs the extraction so:
   - Vite config stays Vite config
   - proxy/runtime helpers live in explicit local modules

### Problem 5 — Bob host responsibilities must be made boring and explicit

`Bob` must remain the editor kernel.

That means:

1. Bob should receive an already-authorized, correctly-shaped envelope from the host
2. Bob should not be forced to infer whether the caller is Roma or DevStudio by hitting the wrong route family
3. host-to-Bob contracts for open/update must be explicit and documented

If `Bob` cleanup is required to make that contract boring, it is in scope.

---

## Out of scope

PRD 069B is **not**:

1. a rewrite of Roma builder
2. a rewrite of Bob session architecture
3. a new internal control plane PRD
4. a new auth system
5. a generic frontend refactor program
6. a Cloudflare/infra PRD

Only the code needed to restore the correct boundary and split the unsafe workspace blob is in scope.

Implementation constraint:

1. no new build pipeline or bundler layer is introduced for the DevStudio split
2. the split must use simple Vite-served local modules/assets only
3. Bob code changes stay minimal and only where needed to remove a real hidden host assumption

---

## Execution phases

### Phase 1 — Route-chain truth and blast-radius map

Goal:
- identify the exact route families currently used by:
  - DevStudio instance list
  - DevStudio instance boot
  - Roma builder open
  - Bob host read/update paths

Deliverables:
1. exact current failure points with concrete request/response examples
2. explicit list of which routes are:
   - correct
   - wrong host/boundary
   - ambiguous and must be clarified
3. for the DevStudio local `401`, the already-known route-chain truth is sufficient; do not block implementation on a standalone document artifact
4. for the Roma `403`, the exact failing product path must be pinned down before any product auth or route changes are attempted

Acceptance:
1. there is no ambiguity about which route family each host currently uses
2. there is no Roma fix attempted before the failing product route chain is explicit
3. DevStudio local route restoration is not delayed by unnecessary documentation work

### Phase 2 — DevStudio host boundary restoration

Goal:
- make DevStudio use only explicit local-tool/internal transport for widget-instance boot into Bob

Scope:
1. add the explicit internal route(s) needed for instance envelope/localization boot
2. remove DevStudio dependence on Bob customer account routes for those reads
3. keep Bob product auth untouched
4. make the new internal read routes reuse shared instance-loading/domain logic
5. make the new internal read routes support both account-owned and curated/platform-owned instance classes
6. keep the response shape aligned with the existing Bob host expectations
7. keep the route restricted to the platform account; customer-support target opens continue to use the dedicated support flow

Acceptance:
1. local DevStudio can list instances
2. local DevStudio can open an instance in Bob without calling Bob customer account routes
3. no product-route auth bypass was added
4. no Tokyo-only partial payload shortcut was introduced
5. both account-owned and curated/platform-owned DevStudio instances can boot correctly
6. the returned core/localization payload still matches the host contract Bob already expects

### Phase 3 — Roma builder/open correction

Goal:
- fix the real `403` path in Roma without auth drift

Scope:
1. trace the exact failing Roma read path
2. fix the account/publicId/instance-kind boundary mismatch
3. verify account-owned and curated/platform-owned open flows separately

Acceptance:
1. authenticated Roma can open the intended widget instances through the correct route family
2. forbidden access still stays forbidden for the wrong account/context
3. no auth capsule weakening was added
4. the Roma fix is justified by the traced failing product path, not copied from the DevStudio local-tool solution

### Phase 4 — DevStudio widget workspace split

Goal:
- reduce the current 2360-line blob into explicit host modules

Minimum split:
1. transport
2. instance loading
3. Bob handoff
4. compile/cache loading
5. UI/controller state

Implementation shape:
1. split into simple local modules/files served by the existing Vite toolbench
2. no new bundler/build abstraction
3. no framework rewrite

Target:
1. `dev-widget-workspace.html` becomes a thin shell/entrypoint instead of the place where all transport and host logic lives
2. each extracted module should stay small enough to review directly; target under ~400 LOC per extracted module unless a narrower exception is justified in the PR

Acceptance:
1. `dev-widget-workspace.html` is materially reduced
2. the extracted modules have single, explicit responsibilities
3. route/boundary logic is no longer hidden in a monolithic file

### Phase 5 — `admin/vite.config.ts` cleanup

Goal:
- keep all active admin boundary/proxy work inside this PRD and reduce `admin/vite.config.ts` to a clear host shell

Scope:
1. extract DevStudio proxy logic into explicit local modules
2. extract auth/env helpers into explicit local modules
3. leave `admin/vite.config.ts` as Vite wiring + route registration shell

Acceptance:
1. `admin/vite.config.ts` is no longer the place where the whole DevStudio proxy runtime hides
2. extracted modules stay inside the existing Vite toolbench; no new build abstraction
3. the file ownership remains singular: `069B` owns this surface end-to-end

### Phase 6 — Bob host cleanup

Goal:
- make Bob host contracts boring and explicit for Roma and DevStudio

Scope:
1. clean up host-to-Bob open contract only where needed to remove a real hidden host assumption
2. clean up host-to-Bob update command handling only if the route correction proves it necessary
3. document the resulting host contract
4. avoid broad Bob refactors; Bob is not the main worksite for this PRD

Acceptance:
1. Roma host path is explicit
2. DevStudio host path is explicit
3. Bob no longer depends on the specific hidden host assumptions corrected by this PRD
4. Bob changes remain minimal and directly justified by the failing flows

### Phase 7 — Verification and docs

Goal:
- prove the corrected boundary works and update docs immediately

Scope:
1. local verification for:
   - DevStudio list
   - DevStudio open into Bob
   - Roma widgets
   - Roma builder open
2. cloud-dev verification for Roma widgets + builder
3. docs update

Acceptance:
1. local DevStudio flows work
2. cloud-dev Roma flows work
3. docs match runtime

---

## Required route-family rules after execution

After PRD 069B:

1. `DevStudio` instance list uses explicit internal-tool route(s)
2. `DevStudio` instance boot uses explicit internal-tool route(s)
3. `Roma` product reads continue to use product account route(s) with capsule auth
4. `Bob` does not silently absorb host-boundary confusion
5. curated/platform-owned flows are explicit and documented
6. DevStudio internal-tool routes and Roma product routes remain separate solutions to separate authority models

---

## Acceptance gates

PRD 069B is done only when all of these are true:

1. DevStudio no longer calls Roma customer routes for instance listing
2. DevStudio no longer calls Bob customer account routes for instance boot
3. local DevStudio can open a widget instance in Bob successfully
4. Roma widgets load successfully in cloud-dev
5. Roma builder/account-instance open succeeds for the intended account/instance classes
6. forbidden product access still returns `403/401` where it should
7. no new auth bypasses, fake sessions, or trusted-dev shortcuts were introduced
8. the DevStudio internal read handlers reuse shared instance-loading logic and do not return a degraded/partial payload contract
9. `dev-widget-workspace.html` is materially reduced and its responsibilities are split
10. `admin/vite.config.ts` is cleaned up inside this PRD, not split into another workstream
11. Bob host contract is explicit and documented
12. docs match the corrected runtime

Execution order inside this PRD:
1. DevStudio host boundary restoration first
2. verify local DevStudio works
3. trace Roma `403`
4. fix Roma product path
5. split workspace
6. clean up `admin/vite.config.ts`
7. do only the minimal Bob cleanup still required after the boundary fixes

---

## Failure conditions

Stop and reassess if execution starts doing any of these:

1. adding a fake DevStudio-as-customer auth model
2. weakening Bob or Roma product auth to make DevStudio work
3. adding host-specific special cases that only hide the route confusion
4. refactoring broad frontend areas unrelated to the failing route chain
5. “solving” Roma curated/account reads by flattening ownership rules
6. keeping the workspace blob intact while adding more route logic into it

---

## Simple and boring end state

The correct end state is boring:

1. `DevStudio` has its own explicit local-tool transport
2. `Roma` keeps customer product transport
3. `Bob` receives a clear host contract
4. curated/platform-owned rules are explicit
5. widget workspace code is split enough that route misuse is obvious in code review

That is the whole point of PRD 069B.
