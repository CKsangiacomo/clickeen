# PRD 070A — Product Boundary Closure and Paris Justification

Status: EXECUTING
Date: 2026-03-15
Owner: Product Dev Team
Priority: P0 (architecture prerequisite for PRD 070B)



## One-line objective

Make the architecture match the real product:
- Roma is the product
- Roma's Next.js API routes are Roma's backend
- Bob is only the editor
- Berlin is the sole auth/session authority
- Tokyo/Tokyo-worker own saved-config and artifact truth
- Paris is not assumed necessary and must justify every remaining responsibility

---

## Core premise

Paris became a monster because it was never tightly defined.

It was:
- a Worker
- with DB access
- with queue/KV/R2 capabilities
- with no hard responsibility contract

That turned Paris into a dumping ground for anything that needed "server-side" behavior.

PRD 070A fixes that by reversing the default:
- Paris is not assumed to own anything
- Paris is not assumed to be needed on any given path
- every current Paris responsibility must prove why it cannot live in:
  - Roma backend
  - Berlin
  - Tokyo/Tokyo-worker
- if it cannot prove that, it must move or be deleted

This is the prerequisite for PRD 070B.

This PRD is not a patch and not a wrapper exercise.

It is a functional ownership refactor:
- product flows must change owners
- calls must change direction
- responsibilities must move
- wrong participants must leave the path entirely

Because of that, cleanup is part of the functional work, not optional follow-up.

Required execution posture:
- delete obsolete routes
- delete obsolete direct calls
- delete obsolete proxies
- delete obsolete helpers
- delete obsolete docs/contracts

Forbidden execution posture:
- layer new paths on top of old ones
- keep both old and new ownership alive
- preserve wrong owners "for now"
- call proxying/wrapping a completed refactor

---

## Simple system truth

1. Roma is the product
   - Roma is the dashboard/application the customer uses:
   - widgets
   - templates
   - settings
   - billing
   - locale config
   - publish
   - duplicate
   - Builder entry

2. Roma has its own backend
   - Roma's Next.js API routes are the backend for Roma's UI.
   - That is the normal backend boundary for the product.

3. Bob is the editor
   - Bob is only the widget editor UI/kernel Roma opens.
   - Bob is not a second product app.
   - Bob is not a second backend client in account mode.

4. Berlin is auth/session truth
   - Berlin is the sole auth/session authority for the product.
   - Berlin owns identity, session bootstrap, and session-minted entitlement truth.
   - Roma gets auth/session truth from Berlin, not from Paris.

5. Tokyo/Tokyo-worker own saved-config and artifact truth
   - Tokyo owns saved base content and artifact truth.
   - Tokyo-worker owns artifact writes, pointer moves, publication, and artifact integrity.
   - Neither owns product UX or product policy.

6. Roma should boot operational
   - When the user logs in and lands in Roma, session/bootstrap must mint the account/user/product truth Roma needs to operate.
   - At load, Roma should already know the active account, role, entitlement truth, and product access truth for that session.
   - After load, Roma should not need backend calls to rediscover who the user is or what the account is allowed to do.

7. Roma operates from minted account and user truth
   - Once the user logs in, the system must mint the session's user/account/product truth.
   - Roma must receive that truth at bootstrap and operate from it.
   - Roma should not need follow-up backend calls to figure out who the user is, what account they are in, or what that account is allowed to do.

8. The system never checks or gates against itself
   - We own all the internal surfaces in this product path.
   - Therefore internal `missing`, `malformed`, `invalid`, and `expired` states are bugs, not normal runtime states.
   - Product truth is decided once at the correct external boundary, then internal systems execute against it.
   - Internal systems must not add checks, gates, or fallback behavior against already-minted system-owned truth.
   - If an internal contract is broken, the response is to surface the bug and fix the producer, not normalize the broken state downstream.

8. Paris must justify its existence
   - Paris is not the default owner of anything.
   - Paris exists only if a responsibility cannot cleanly live in Roma backend, Berlin, or Tokyo/Tokyo-worker.

If the codebase violates any of these truths, 070A is not done.

---

## Product truth

The product is simple:

1. The customer uses `Roma`.
2. Roma server routes are the backend for that product.
3. `Bob` is only the editor Roma opens.
4. `Berlin` mints session/account/entitlement truth once.
5. `Tokyo` stores saved base content and artifacts.
6. `Tokyo-worker` writes/publishes artifacts.
7. On the product/Babel path governed by this PRD, `Paris` is not part of the architecture.

For account product flows, the normal shape is:
- browser -> Roma UI
- browser -> Roma API route
- Roma API route -> Berlin directly for auth/session truth
- Roma API route -> San Francisco directly for overlay generation
- Roma API route -> Tokyo/Tokyo-worker directly for saved-config, overlay artifacts, publication, and artifact truth

That is the target.

---

## Top-level tenets

1. The system never checks or gates against itself
   - We own all the internal surfaces in this product path.
   - Therefore internal `missing`, `malformed`, `invalid`, and `expired` states are bugs, not normal runtime states.
   - Product truth is decided once at the correct external boundary, then internal systems execute against it.
   - Internal systems must not add checks, gates, or fallback behavior against already-minted system-owned truth.
   - If an internal contract is broken, the response is to surface the bug and fix the producer, not normalize the broken state downstream.

2. Roma is the product
   - widgets, templates, settings, billing, locale config, publish, duplicate, and Builder entry are Roma product surfaces.
   - Roma owns product payloads, product UX semantics, and product flow ownership.

3. Roma's Next.js API routes are Roma's backend
   - They are the normal backend boundary for the product.
   - Product reads and product payload shaping belong there.

4. Bob is editor-only
   - In account mode, Bob must not become a second product backend or orchestration surface.

5. Berlin is the sole auth/session authority
   - Session bootstrap mints identity, account, and entitlement truth once for the session.
   - Roma gets auth/session truth from Berlin.
   - Paris is never an auth authority on the product path.
   - Hot product paths must not keep re-resolving that truth.

6. Roma operates from minted account and user truth
   - Once the user logs in, the system mints the session's user/account/product truth.
   - Roma receives that truth at bootstrap and operates from it.
   - Roma should not need follow-up backend calls to figure out who the user is, what account they are in, or what that account is allowed to do.

7. Tokyo/Tokyo-worker own saved-config and artifact truth
   - Tokyo owns saved-config truth and artifact truth.
   - Tokyo-worker owns artifact execution truth.
   - Product logic must not invent second sources of truth over either.

8. Overlay planes must stay split
   - Roma owns overlay control-plane intent and governance.
   - San Francisco owns overlay generation.
   - Tokyo/Tokyo-worker are the target canonical overlay artifact plane.
   - Venice owns request-time overlay selection/composition.
   - Paris does not participate in the Babel overlay path.
   - Any current code path that still routes Babel overlays through Paris is wrong current code to delete, not a design carve-out.

9. Paris is guilty until proven necessary
   - Paris is not the owner of product reads.
   - Paris is not the owner of product payload shaping.
   - Paris is not the owner of auth/session truth.
   - Paris is not the owner of readiness/status truth.
   - Paris is not the owner of Roma product routes.
   - Every remaining Paris responsibility must justify why it cannot live elsewhere.

10. If Roma can do it directly, Paris is forbidden in that path
   - Paris is not a mandatory middle layer.
   - If Roma backend can call the real system of record directly, it should.

11. If Paris dispatches anything, Roma still owns the decision
   - The user acts in Roma.
   - Roma decides what should happen.
   - If Paris is used for queue transport or worker-only execution, Paris is only a dumb execution step, not a second decision-maker.

12. Roma should boot operational
   - After login/bootstrap, Roma should already have what it needs to operate.
   - Backend calls after load are for real commands, persistence, and genuinely fresh server state, not rediscovery of already-minted product truth.

13. Delete wrong owners, do not patch around them
   - 070A is an ownership-refactor PRD.
   - Every slice must remove a wrong owner, duplicate path, or unjustified Paris dependency.

---

## Why PRD 070B is blocked by 070A

PRD 070B needs:
- one product backend boundary
- one save path
- one desired-locale owner
- one readiness truth
- one consumer contract

It cannot hold while:
- Bob bypasses Roma
- Berlin is not treated as final auth/session authority
- Tokyo/Tokyo-worker do not cleanly own artifact truth
- Paris still behaves like a central product/backend layer

So 070B is sequenced after 070A on purpose.

---

## What Paris may still be for

The only defensible Paris scope is narrow worker-specific capability.

This PRD is about the product/Babel path.

On that path:
- Paris has no role in overlay creation
- Paris has no role in overlay storage
- Paris has no role in overlay serving

Any future claim that Paris is needed elsewhere must be justified in a separate PRD.

---

## What Paris must not be

Paris must not be:
- Roma's backend
- the product backend
- a product read owner
- a product payload shaper
- an auth authority
- a readiness/status authority
- a mandatory middle layer between Roma and Berlin/Tokyo
- a place to throw "server-side" logic that does not have a clear owner

---

## Current architecture drift

The current system still violates the target model in several ways:

- Paris still owns or influences Roma-shaped product surfaces.
- Bob still talks directly to Paris on account-mode flows.
- Bob still talks directly to Tokyo on account-mode save flows.
- Roma still performs multi-service business choreography in places where its own backend boundary should be simpler.
- Paris still acts too much like a central product/domain layer instead of a narrow worker.

This is why the system feels like drift:
- ownership is unclear
- reads and commands enter through different executables
- product truth is spread across too many services

---

## Responsibility map

### Roma UI

Roma UI owns:
- product screens
- navigation
- product interactions
- Builder entry

Roma UI calls:
- Roma API routes

### Roma backend

Roma backend owns:
- product reads
- product payload shaping
- product response contracts for Roma screens
- product-flow entrypoints for account mode
- overlay control-plane commands and governance surfaces
- direct calls to Berlin and Tokyo/Tokyo-worker when those are the right systems of record

Roma backend may call Paris only when:
- the operation truly needs narrow worker-specific capability

### Bob

Bob owns:
- editor UI
- preview
- local working-copy editing

Bob does not own:
- account product reads
- account product orchestration
- direct account-mode calls to Paris
- direct account-mode writes to Tokyo

In account mode, Bob must go through Roma routes only.

### Berlin

Berlin owns:
- identity
- session bootstrap
- session/account/entitlement minting

### Tokyo

Tokyo owns:
- saved base content
- artifact truth
- target canonical overlay artifacts

### Tokyo-worker

Tokyo-worker owns:
- artifact writes
- pointer moves
- publication
- artifact completion truth
- target execution/publish plane for canonical overlays

### San Francisco

San Francisco owns:
- overlay generation
- AI generation workflows for locale and future Babel layers

### Venice

Venice owns:
- request-time context resolution
- overlay selection
- overlay composition

### Paris

Paris does not own:
- Roma product routes
- product reads
- product payload shaping
- auth/session truth
- product status/readiness truth
- long-term canonical Babel overlay truth
- overlay generation
- overlay write-path ownership
- overlay storage
- overlay serving
- mandatory coordination between Roma and Berlin/Tokyo

On the product/Babel path, Paris should disappear.

---

## Paris responsibility test

Every current Paris route, helper, and responsibility must be classified as one of:

1. Delete
   - not needed
   - legacy convenience
   - wrong-owner logic

2. Move to Roma backend
   - product read
   - product payload shaping
   - product-flow orchestration
   - overlay control-plane decision/governance

3. Move to Berlin
   - auth/session/entitlement truth

4. Move to Tokyo/Tokyo-worker
   - saved-config truth
   - artifact truth
   - artifact publication/completion truth
   - target canonical overlay artifact plane

5. Move to San Francisco
   - overlay generation

6. Keep in Paris
   - only if it is unrelated to the Babel/product path and justified by a separate responsibility contract

There is no seventh category.

---

## Non-negotiable decisions

### 1. Paris is not Roma's backend

Forbidden wording and design assumption:
- "Paris is the backend of the product"
- "Paris is Roma's backend"

Required:
- Roma UI + Roma Next.js API routes are the product app/backend pair
- Paris is only a narrow worker component if a responsibility justifies it

### 2. No `/api/roma/*` routes in Paris

Paris must not own Roma-shaped product endpoints.

Required:
- Roma product routes live in Roma

### 3. Product reads belong to Roma backend

Required:
- Roma backend owns widgets/templates/settings/billing/locale/product read payloads
- Roma backend assembles Roma-shaped product responses

Forbidden:
- Paris owning Roma page payloads
- Paris owning Roma screen semantics

### 4. Bob account mode must go through Roma

Forbidden:
- Bob browser direct calls to Paris for account product flows
- Bob browser direct writes to Tokyo for account product flows

Required:
- Bob account-mode actions call Roma same-origin routes

### 5. Roma talks to Berlin for auth, not Paris

Required:
- Roma gets auth/session truth from Berlin
- Paris is never used as an auth authority or second bootstrap layer

Forbidden:
- calling Paris to rediscover user/account/entitlement truth Roma should already have

### 6. Roma may call Tokyo/Tokyo-worker directly

Because Roma backend is the product backend:
- it may call Tokyo directly for saved-config/artifact truth
- it may call Tokyo-worker directly when Tokyo-worker is the true owner of a product command

Paris is not the mandatory middle layer.

### 7. Overlay planes are split on purpose

Required:
- Roma owns overlay control-plane decisions and governance
- Bob account-mode overlay actions route through Roma only
- San Francisco is the target generation path for overlays
- Tokyo/Tokyo-worker are the target canonical overlay artifact plane
- Venice remains the request-time overlay composition plane
- Paris does not appear in the Babel overlay path

Forbidden:
- treating Paris as the long-term owner of the generic Babel overlay plane
- treating overlay write-path execution in Paris as proof that overlay truth belongs to Paris
- describing Paris overlay write paths as justified target architecture
- routing Babel overlays through Paris as a design compromise

### 8. If Paris dispatches, it is dumb transport only

Required:
- Roma decides what should happen
- Paris, if used, only executes the worker-specific transport step

Forbidden:
- Paris becoming a second decision-maker for Roma product commands

### 9. Session truth is minted once

Required:
- active product paths execute against the session-minted truth

Forbidden:
- re-reading membership/entitlements on hot product paths
- re-resolving product access truth after bootstrap

### 10. 070A is deletion-first

Required:
- remove wrong owners
- remove duplicate paths
- remove unjustified Paris dependencies
- remove Bob account-mode direct fanout

Forbidden:
- helper churn
- abstraction churn
- compatibility branches that preserve dual ownership

---

## Execution phases

### Phase 1 — Paris justification audit

Goal:
- force every current Paris responsibility to justify why it still exists

Scope:
- classify every current Paris route/capability as `delete`, `move to Roma`, `move to Berlin`, `move to Tokyo/Tokyo-worker`, or `keep in Paris`

Acceptance:
- every remaining Paris responsibility has an explicit justification

### Phase 2 — Roma backend closure

Goal:
- make Roma's Next.js API routes the explicit product backend boundary

Scope:
- move product reads and product payload shaping into Roma backend
- remove any lingering assumption that Paris owns product reads
- make Roma the control-plane entrypoint for overlay commands

Acceptance:
- Roma product flows are clearly owned by Roma backend routes

### Phase 3 — Berlin auth closure

Goal:
- make Berlin the sole auth/session authority in reality, not just in wording

Scope:
- remove Paris from any auth-authority role
- remove downstream re-bootstrap/re-auth patterns

Acceptance:
- Roma gets auth/session truth from Berlin and does not call Paris for auth

### Phase 4 — Bob account-mode closure

Goal:
- stop Bob from acting like an independent account product client

Scope:
- route Bob account-mode product flows through Roma only
- remove Bob browser direct Paris/Tokyo account-mode calls
- remove Bob browser direct Paris overlay calls entirely

Acceptance:
- in account mode, Bob talks only to Roma routes

### Phase 5 — Tokyo/Tokyo-worker truth closure

Goal:
- make saved-config and artifact truth belong cleanly to Tokyo/Tokyo-worker

Scope:
- remove any second readiness/completion truth from Paris
- ensure artifact completion truth is not split across workers
- remove Paris from the Babel overlay path
- lock the target `Roma -> San Francisco -> Tokyo/Tokyo-worker -> Venice` path

Acceptance:
- Roma reads product truth from the actual owners, not from Paris reinterpretation
- Paris is absent from overlay creation, storage, and serving

### Phase 6 — Paris contraction or deletion closure

Goal:
- reduce Paris to the smallest justified surface, or delete it from paths where it is not needed

Scope:
- keep only the Paris capabilities that passed the justification test

Acceptance:
- Paris is either tiny and clearly justified, or gone from the paths where it was unnecessary

### Phase 7 — Call-graph proof closure

Goal:
- prove the actual architecture

Scope:
- verify browser -> Roma UI/API is the product boundary
- verify Roma backend -> Berlin direct for auth/session truth
- verify Roma backend -> Tokyo/Tokyo-worker direct where they are the real owners
- verify Paris only appears on narrowly justified worker paths
- verify Bob account mode is Roma-only from the browser perspective

Acceptance:
- one coherent product/backend model exists
- 070B can execute without fighting split ownership

---

## Execution guardrails

### Red lines

Forbidden during PRD 070A:
- translation feature work from PRD 070B
- new Paris product-route ownership
- moving more product truth into Paris
- moving more account-mode product behavior into Bob
- treating Paris as a mandatory middle-layer backend for normal product reads or commands
- blessing Paris as the long-term owner of generic Babel overlays
- describing current Paris overlay write paths as justified target architecture
- preserving Paris inside the Babel overlay path

### Elegant-engineering rule

Every 070A change must do at least one of these:
- remove a wrong owner
- remove a duplicate path
- remove a forced dependency on Paris
- make Roma backend more clearly the product backend
- make Berlin/Tokyo/Tokyo-worker more clearly the direct truth owner where appropriate

If a change only moves code around without improving ownership or dependency shape, it is out of scope.

### Smallest-diff rule

Prefer:
- deleting a route over wrapping it
- deleting a direct browser call over abstracting it
- moving a read back to Roma backend over teaching Paris one more product concept
- removing a forced Paris dependency over adding a helper around it

### Stop conditions

Stop and re-evaluate if execution starts to:
- describe Paris as a product backend again
- add product reads or payload shaping back into Paris
- preserve Bob account-mode direct fanout
- add internal self-checks/gates instead of fixing the producer
- keep a Paris responsibility that cannot clearly justify itself

---

## Proof that 070A is complete

070A is complete only when all of the following are true:

1. Roma is the only product app for account flows.
2. Roma's own API routes are the backend boundary for those product flows.
3. Bob is only an editor UI in account mode.
4. Berlin is the sole auth/session authority.
5. Tokyo/Tokyo-worker own saved-config and artifact truth.
6. Every remaining Paris responsibility has justified why it still exists.
7. Paris is either tiny and clearly justified, or absent from the paths where it was unnecessary.
8. PRD 070B can execute without fighting split ownership on every translation-related path.
