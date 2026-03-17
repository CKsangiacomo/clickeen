# PRD 072 — Roma Boring SaaS Shell: Current-Account Truth and Direct Product Flows

Status: EXECUTING
Date: 2026-03-17
Owner: Product Dev Team
Priority: P0 (product unblocker)
Depends on:
- `070A__PRD__Product_Boundary_Closure.md`
- `documentation/architecture/AccountManagement.md`

---

## One-line objective

Make Roma behave like a boring SaaS shell:
- user logs in once
- Berlin mints the active account and entitlement truth once
- Roma operates from that truth
- normal product domains stop asking the browser "what account is this?"
- internal systems stop re-checking already-minted system truth

Primary product goal of PRD 072:
- make today's Roma excellent at single-account operation

---

## Architectural stance of this PRD

PRD 072 is **not** a patch-on-patch effort to make the current Roma shape limp forward.

PRD 072 is a core architectural course-correction.

It requires:
- changing the Roma product-shell contract
- deleting duplicated current-account plumbing
- deleting obsolete routes, helpers, and browser handoff paths
- replacing the wrong normal path instead of preserving it for compatibility

Large code deletion is not a side effect of this PRD.
Large code deletion is part of the intended success condition.

If implementation tries to keep the old route model, old browser-led account routing, and old duplicated helpers alive "just in case," then PRD 072 has not been implemented correctly.

---

## What this PRD is and is not

This PRD defines the **intended target state** for Roma.

It is:
- a contract simplification PRD
- a product-shell correction PRD
- a boundary cleanup PRD
- a direct response to current code paths that duplicate current-account truth
- an explicit delete-and-replace architectural change, not a compatibility wrapper exercise

It is not:
- a claim that the current Roma code already behaves this way
- a generic architecture essay
- a benchmark or performance proof
- a standalone proof that Roma is already ready for 2M concurrent or total users
- a "stabilize the existing shape with more glue code" effort

The goal of PRD 072 is to make the intended operating model explicit enough that implementation can hard-cut toward it and delete the wrong path.

---

## Non-negotiable product truths this PRD must enforce

### Truth 0: make today's Roma excellent at single-account operation

This is a non-negotiable goal of PRD 072.

Today’s Roma is not an agency shell, not an internal control plane, and not a future multi-account experiment.

Today’s Roma must be excellent at one thing:
- one signed-in human
- one active account
- one boring, world-class customer workspace

This means:
- no customer-facing account switching in Roma
- no route design shaped around future agency behavior
- no internal-tool behavior leaking into Roma
- no preserving complexity today for speculative multi-account tomorrow

Agency-specific multi-account behavior, if built later, belongs to a separate Roma-for-agency product version with its own contract.

### Truth 1: asset management must be boring

Asset management is not allowed to become a complex Roma product problem.

At the Roma product boundary, assets must be:
- current-account scoped
- deterministic
- easy to reason about
- easy to debug
- independent of browser-led account rediscovery

This means:
- one current-account asset contract for normal Roma usage
- dedicated asset operations for list/upload/delete/resolve
- dedicated usage/summary behavior instead of piggybacking on arbitrary list endpoints
- Builder using the same current-account asset contract, not inventing its own account-routing shape

Internal gateway/proxy implementation is allowed.
Product-shell complexity is not.

### Truth 2: PLG scale is existential, not optional

Clickeen is a PLG product.
Free users are not secondary traffic.
They are part of the moat.

Therefore Roma must be designed so that operating cleanly for 2M users across tiers is a first-order product requirement.

This PRD does **not** claim that the current codebase has already proven 2M-user readiness.

It does require that the Roma shell contract be designed so 2M-user scale is feasible:
- one shell contract across all customer tiers
- entitlement differences expressed through minted policy, not route-shape divergence
- bounded and deliberate product flows
- no redundant browser-driven account resolution
- no accidental chatty route model as the default product behavior

Any Roma design that works only for a small managed customer base but collapses under PLG free-user volume is a failed design for this product.

### Truth 3: AI in Roma must remain simple and legible

AI account behavior in Roma is straightforward:
- access derives from current-account entitlements and AI profile
- the named agent available to that account derives from that entitlement/profile truth
- AI execution happens in San Francisco

Roma does not own:
- provider keys
- model execution
- agent orchestration
- hidden second-source AI truth

Roma does own:
- surfacing what the current account is entitled to use
- issuing or carrying the product-path grant/capsule needed for execution
- presenting explicit AI availability/deny states to the user

The system must not be confused about this boundary.

Simple rule:
- Roma decides what this account is allowed to use
- San Francisco runs the agent

For current product behavior:
- free/minibob-style entitlement resolves to the SDR widget copilot family
- paid account entitlement resolves to the customer-success/editor widget copilot family
- provider/model choice is executed in San Francisco under the allowed AI profile, not invented in Roma UI logic

LLM/provider reality remains explicit and server-owned:
- profiles resolve the allowed provider/model set
- San Francisco chooses and enforces the provider/model within that policy
- Roma should show the policy-derived AI profile and agent availability, not become a model-routing surface by accident

---

## Core premise

The product is not conceptually hard.

For a normal customer session, the shape should be:

1. user signs in
2. bootstrap resolves the active account
3. entitlements/authz are minted for that account
4. Roma domains operate on that account
5. downstream systems talk directly to the real owner systems

That is normal SaaS behavior.

The current Roma implementation violates that simplicity.

The result is not "extra safety".
The result is:
- duplicated identity/account resolution
- browser-driven orchestration of server-owned truth
- routes that keep asking for `accountId` after bootstrap already resolved it
- product domains that fail because no layer trusts the previous layer

This PRD restores the normal shape.

And in this product, that normal shape is strict:
- Roma is a single-current-account customer shell
- Roma does not own account switching
- DevStudio is a separate local superadmin/internal surface, not a Roma product domain
- PRD 072 exists to make today's Roma excellent at single-account operation

The intended end state is a high-quality SaaS workspace:
- one current workspace truth
- one current-account contract
- one normal route model for customer domains
- explicit tiers/entitlements applied from minted policy, not from route-shape differences
- internal tools and exceptional control-plane behavior kept outside normal Roma product paths
- boring asset management at the product boundary
- AI entitlement truth surfaced simply while San Francisco owns execution
- a shell shape that remains viable under PLG-scale user volume

The intended normal product chain is:
- bootstrap mints current-account truth
- Roma calls one current-account product route
- that route calls the real owner system

That is the boring path this PRD restores.

### Central contract change

The visible center of implementation is replacing normal customer-path route shapes like:
- `/api/accounts/:accountId/*`
- `/api/roma/*?accountId=...`
- request bodies that restate `accountId`

with the boring current-account route layer:
- `/api/account/*`

That route-model change is the center of the fix, but it is not the whole fix.

It only counts as success when it is implemented together with:
- deletion of browser-led current-account routing for normal product usage
- dedicated summary routes where Roma currently piggybacks on arbitrary list endpoints
- Builder host/message simplification so Bob no longer replays current-account identity back through the browser
- deletion or collapse of helpers/abstractions that only existed to support the wrong route shape

---

## The problem this PRD solves

### Problem 1: the active account is known, but the app behaves like it is not

Bootstrap already resolves:
- signed-in user
- active account
- account role
- account authz capsule
- entitlement snapshot

But after that, Roma domains still pass `accountId` explicitly through browser requests and query params as if the current account were unknown.

This creates a broken product shape:
- the shell says "you are in account X"
- each domain then asks again "which account is this?"
- server routes then validate the same truth again

Instead of one current-account product shell, we get N local copies of account resolution.

### Problem 2: the system checks itself against truth it already minted

On the normal product path, internal surfaces are system-owned:
- Berlin owns auth/account truth
- Roma owns product shell/backend truth
- Tokyo/Tokyo-worker own saved/artifact truth

But current flows still behave as if those internal boundaries are hostile or unknown.

That creates useless re-check loops:
- bootstrap mints current-account truth
- browser sends that truth back down
- server routes ask for proof of the same truth again
- another internal system asks again

This is not external security.
This is the system re-validating itself instead of executing.

### Problem 3: the browser became an orchestration bus

The browser should express user intent.

It should not:
- carry current-account identity through every normal request
- bridge already-known product truth between internal services
- act as the authority on which account the product is operating on

Builder currently shows the worst version of this:
- Roma knows the account
- Roma knows the widget
- Roma knows the capsule
- Bob is opened by Roma
- then browser-level message choreography still carries account/product commands back and forth as if no system knew the current context

This is the opposite of a boring SaaS shell.

### Product consequence

The practical outcome is exactly what we are seeing:
- domains do not compose cleanly
- domains block on local context confusion
- routes and clients drift apart
- "nothing talks to nothing"
- the product becomes operationally blocked even though most individual subsystems exist

---

## Deterministic diagnosis in current code

The problem is visible in the current repo snapshot:

- Roma bootstrap correctly resolves active account and authz:
  - `roma/components/use-roma-me.ts`
  - `roma/app/api/bootstrap/route.ts`
- Domains still treat `accountId` as a browser-supplied runtime input:
  - `roma/components/widgets-domain.tsx`
  - `roma/components/templates-domain.tsx`
  - `roma/components/assets-domain.tsx`
  - `roma/components/team-domain.tsx`
  - `roma/components/usage-domain.tsx`
- Roma account API helpers are built around replaying the account capsule into browser-originated calls:
  - `roma/components/account-api.ts`
- Route families still require explicit `accountId` for normal current-account product usage:
  - `roma/app/api/roma/widgets/route.ts`
  - `roma/app/api/accounts/[accountId]/*`
- Builder still uses browser orchestration for account-mode product actions:
  - `roma/components/builder-domain.tsx`

The system already has the truth.
The product path simply does not trust and use it correctly.

---

## Clarifications from code audit

This PRD is based on the real failure pattern in code, not on a simplified bug story.

### Clarification 1: Berlin bootstrap is already strict

Berlin does **not** treat "successful bootstrap with no active account" as a normal happy-path state.

Current backend contract:
- if no default/active account can be resolved, Berlin returns `coreui.errors.auth.contextUnavailable`
- it does not mint a normal bootstrap payload with `activeAccount = null`

So this PRD must **not** normalize missing current-account truth as an expected success case inside Roma.

Implication:
- missing active account is a producer bug or account-state bug
- Roma must surface it clearly
- Roma must not silently invent or infer product truth that Berlin failed to mint

### Clarification 2: empty-string account context is a real smell, but not the root cause

Current Roma helpers still collapse missing account context into empty strings:
- `resolveActiveRomaAccount(...)` normalizes fields to `''`
- `resolveActiveRomaContext(...)` returns `accountId: ''`

That is bad API shape because it weakens the distinction between:
- "valid current account"
- "no current account"

But the dominant runtime failure is **not** malformed requests with `/api/accounts//...`.

Most current domains fail closed:
- they guard on `if (!accountId) return`
- they show a "No account is available..." state
- they stop before making the next request

So `''` is a hygiene bug and a clarity bug.
It is not the primary architectural blocker.

Practical implication:
- the product often looks empty, blocked, or permanently unavailable
- but that is mostly because domains stop early, not because the shell is successfully driving cross-account work with malformed identity
- the current failure mode is "blocked by duplicated truth plumbing", not "dangerously routed to the wrong account"

### Clarification 3: useRomaMe does not auto-loop forever

`useRomaMe()`:
- loads once on mount
- caches the result
- proactively refreshes only when valid authz data exists

When bootstrap fails validation, `useRomaMe()` enters error state.
The user may manually retry and hit the same failure again, but the hook is not in an autonomous infinite retry loop.

So the real problem is not "retry storm logic".
The real problem is:
- bootstrap/product truth is strict
- Roma domains depend on it
- Roma still duplicates current-account plumbing everywhere after bootstrap

### Clarification 4: this PRD does not solve the issue by adding fallback account selection in Roma

It may be tempting to say:
- if bootstrap has no active account, auto-pick `accounts[0]`
- or show an account picker inside Roma and continue

That is not the canonical fix for this PRD.

Why:
- active-account resolution is Berlin-owned
- Roma must consume minted current-account truth, not become a second account-resolution authority
- auto-picking in Roma would reintroduce exactly the same class of duplicated truth this PRD is trying to remove

If account selection exists anywhere in the system, it must remain aligned with Berlin-owned active-account state and upstream account-state behavior, not Roma product behavior.

### Clarification 5: this is not a two-line null-handling fix

There are useful hygiene fixes:
- stop returning `''` for missing current-account helpers
- surface missing current-account state explicitly
- make "no account" product states clearer

Those changes should happen.

But they are not sufficient on their own.

Why:
- even with perfect null handling, the normal Roma product path still redundantly carries `accountId`
- domains still act like the browser must restate current-account truth
- routes still act like current-account truth is unresolved after bootstrap
- Builder still adds browser orchestration on top of already-known context

This PRD therefore treats the issue as a product-shell contract problem first, with helper cleanup as a supporting simplification.

---

## How we got here

This drift is the predictable result of over-optimizing for explicit boundaries.

The codebase correctly pushed toward:
- strict contracts
- explicit ownership
- same-origin product routes
- capsule-based account authz
- host-backed Builder boot

But AI execution followed that pattern too literally.

Instead of:
- one current-account product shell

we got:
- one more explicit parameter
- one more explicit route
- one more explicit validation
- one more browser handoff

Each local decision looked "safe".
The aggregate system became unusable.

This PRD does not relax the architecture.
It applies the architecture correctly to a normal SaaS product flow.

---

## Boundary correction this PRD makes explicit

### Roma is not a multi-account control plane

Roma is not the place where the customer chooses "which account am I in?" on every domain.

For Roma product usage:
- Berlin/session/bootstrap mint the current account
- Roma receives that current-account truth
- Roma operates on that one current account

Therefore:
- Roma should not have a customer-facing account-switching contract
- Roma normal product routes should not be shaped around explicit `accountId`
- if active-account selection or switching exists anywhere in the system, it is upstream account-state behavior, not a Roma domain behavior

### DevStudio is not part of Roma

DevStudio is a local superadmin/internal management surface.

It is not:
- a Roma customer domain
- a Roma product workflow
- a reason to complicate Roma route contracts
- a reason to leak internal-tool boot/debug assumptions into customer flows

Shared libraries are acceptable.
Shared product/runtime assumptions are not.

---

## Simple system truth

For ordinary Roma product usage, there is exactly one active account.

Normal flow:

1. Berlin mints identity + active-account truth
2. Roma bootstraps that truth once
3. Roma domains operate on the current account
4. Roma server routes call the real owner systems directly
5. Bob edits the selected widget only

That means:
- systems talk directly to each other
- systems know which current account they are operating on
- the browser does not continuously re-teach the backend what session it is in

This is the specific SaaS quality bar PRD 072 is aiming at.

---

## What PRD 072 is intended to deliver

### 1. World-class SaaS shell behavior

Roma should feel like a serious SaaS workspace:
- login once
- land in one current account
- every domain works from that current account without re-asking the browser for identity
- today's Roma is excellent at that single-account job

That means:
- current-account truth is minted once
- normal domains run on current-account routes
- Builder is a focused editor session, not a second identity-routing surface

### 2. Simple development and debugging

The intended implementation standard is:
- one authoritative bootstrap truth
- one normal route family for current-account product behavior
- explicit "no account" and upstream failure states
- no duplicate browser/query/body/path ways to restate the same account context

When this PRD is implemented correctly, engineers should debug normal Roma behavior in a short chain:
1. did bootstrap mint valid current-account truth?
2. did the current-account route resolve that truth correctly?
3. did the owner system respond correctly?

### 3. Deterministic product-shell asset management

PRD 072 does not invent a new asset backend.

It makes Roma's **product-shell contract** for assets deterministic:
- Assets operates on the current account only
- Usage reads current-account storage through a current-account product contract
- Builder does not need to reconstruct asset ownership through browser choreography
- Roma does not piggyback storage summary on arbitrary asset-list calls as the normal product contract
- Roma asset flows are bounded and intentionally shaped for predictable operator and user behavior

The objective is not to redesign Tokyo asset control.
The objective is to stop Roma from making asset behavior depend on repeated client-side account re-resolution.

### 4. One shell contract across every tier

This PRD is meant to make Roma work with one customer-shell model across free and paid tiers:
- the shell contract stays the same
- current-account route shape stays the same
- tier differences come from minted role/profile/entitlements
- the free tier is part of the primary design load, not a side case

This is important for scale because scale comes from one stable contract, not from per-tier route divergence.

Important distinction:
- PRD 072 must encode the shell shape required for 2M-user PLG viability
- PRD 072 does **not** by itself replace later capacity verification, caching work, and throughput work
- "we will think about scale later" is explicitly rejected by this PRD

### 5. Simple AI surface and execution boundary

Roma AI behavior must be boring:
- the account either has access to a named AI capability or it does not
- that access derives from entitlements/profile
- execution is delegated to San Francisco

PRD 072 does **not** make Roma a second AI orchestration service.

Therefore:
- Roma should not invent a complex AI route family unless server-owned mutable AI state actually exists
- if AI state is already fully derivable from bootstrap entitlements/profile, Roma should read it there
- San Francisco remains the owner of provider/model execution and agent runtime behavior

---

## Non-negotiable target state

1. Roma has one current-account product context after bootstrap.
2. Normal Roma domains do not require browser-supplied `accountId`.
3. Normal current-account server routes resolve the account server-side from the minted session/bootstrap/authz context.
4. Missing current-account state is represented explicitly as `null`/missing, never as `''` sentinel values in Roma current-account helpers.
5. Browser code is not the source of account truth.
6. Internal services do not re-check already-minted current-account truth unless crossing a real authority boundary.
7. Systems talk directly to the real owner systems.
8. Builder remains editor-only and stops behaving like a second product client for account identity.
9. Roma customer flows do not implement account switching or browser-led account targeting.
10. DevStudio is a separate local superadmin surface and contributes no product-path requirements to Roma.
11. This is a hard-cut simplification PRD, not a wrapper-on-wrapper PRD.
12. The same Roma shell contract applies across all customer tiers; only policy/entitlements vary.
13. PRD 072 defines the correct scaling shape for the shell, but does not substitute for later infra/performance work.
14. Asset management is a boring current-account product capability, not a multi-path orchestration problem.
15. Dedicated summary/usage contracts exist where needed; Roma does not rely on arbitrary list endpoints as a permanent product contract.
16. Roma's normal shell contract must remain viable for PLG-scale user volume, including a very large free-user base.
17. Today's Roma is optimized for single-current-account excellence, not speculative multi-account behavior.
18. Roma AI behavior is entitlement-derived and legible; San Francisco owns agent execution and provider/model routing.
19. Current-account handlers reuse the existing signed-capsule authz pattern; PRD 072 does not invent a third account-resolution mechanism.
20. Usage has a dedicated current-account summary contract and no longer infers summary data from unrelated list endpoints.

---

## Top-level tenets for this PRD

1. Roma is a boring SaaS shell
   - After login/bootstrap, the shell knows the current account and operates from it.

2. Browser is not the source of account truth
   - The browser expresses user intent.
   - It does not continuously restate current-account identity for normal product flows.

3. Systems do not check against themselves
   - Already-minted internal current-account truth is not re-asked and re-proven across every hop.

4. Systems talk directly to real owners
   - Roma talks to Berlin for auth/account truth.
   - Roma talks to Tokyo/Tokyo-worker for saved/artifact truth.
   - Roma talks to San Francisco for AI execution.
   - The browser is not the relay for those ownership relationships.

5. Explicit account targeting is exceptional
   - `accountId` is not part of normal Roma customer routes.
   - If explicit account targeting exists at all, it belongs only to exceptional internal/control-plane behavior outside normal Roma product usage.

6. Builder is a focused editor session
   - Builder opens one concrete widget.
   - It must not reintroduce product-shell account discovery problems.

7. Delete redundant account plumbing
   - The fix is to remove duplicated current-account resolution, not to keep both paths alive.

8. Roma is single-current-account
   - Roma does not own account switching.

9. DevStudio is a separate internal surface
   - DevStudio is not a Roma product boundary and does not shape Roma contracts.

10. Assets are boring
   - Roma asset management must be straightforward at the product boundary.
   - Internal gateway complexity must not leak into customer flows.

11. PLG scale is a design input
   - The shell must be designed for large free-user volume from the start.
   - Scale cannot be postponed by relying on a chatty or redundant route model.

12. Make today's Roma excellent at single-account operation
   - Do not compromise today's shell for future agency behavior.
   - Agency, if built later, is a separate product contract.

13. AI policy is simple; AI execution is elsewhere
   - Roma surfaces entitlement-derived AI availability.
   - San Francisco owns the agent runtime and provider/model execution.

14. Reuse the signed-capsule authz transport
   - Current-account routes reuse the existing signed account-authz capsule verification pattern.
   - For normal `/api/account/*` routes, server handlers verify the signed capsule and extract `payload.accountId` server-side.
   - Remove browser-supplied raw `accountId`; do not invent a new authz transport.

---

## Canonical product route model after this PRD

Roma must expose a current-account product route layer for ordinary product usage.

Representative shape:

- `GET /api/account/widgets`
- `POST /api/account/widgets/duplicate`
- `GET /api/account/templates`
- `GET /api/account/assets`
- `POST /api/account/assets/upload`
- `DELETE /api/account/assets/:assetId`
- `GET /api/account/team`
- `GET /api/account/team/invitations`
- `POST /api/account/team/invitations`
- `GET /api/account/usage`
- `GET /api/account/locales`
- `PUT /api/account/locales`
- `GET /api/account/instance/:publicId`
- `PUT /api/account/instance/:publicId`
- `GET /api/account/instances/:publicId/localization`
- `GET /api/account/instances/:publicId/l10n/status`
- `POST /api/account/instances/:publicId/publish`
- `POST /api/account/instances/:publicId/unpublish`
- `POST /api/account/instances/:publicId/rename`

Rules:

- current-account routes resolve account context server-side
- browser callers do not pass `accountId` for those normal routes
- route handlers authorize by reusing the existing signed account-authz capsule verification pattern
- the intended handler shape is: verify the signed capsule on the server, read `payload.accountId`, then call the real owner system
- normal `/api/account/*` handlers use the existing request-level capsule verification path that does not require a browser-supplied account parameter
- explicit-account verification helpers remain only for exceptional routes that truly still need an explicit account target outside the normal Roma customer shell
- the signed capsule remains the authz transport unless deliberately replaced by an equivalent server-owned mechanism
- the browser is not responsible for supplying current-account identity
- Roma adds a dedicated `/api/account/ai` route only if AI state exists that is not already derivable from bootstrap entitlements/profile

Explicit account routes remain only where they are semantically required:

- they are not part of the normal Roma customer shell
- they belong only to exceptional internal/control-plane behavior if such routes are still required elsewhere in the system
- they must not become dependencies of Roma product domains

---

## Domain target behavior after this PRD

### Home

Home reads current-account summary only.
It never asks the user or browser to restate which account the product is currently in.

### Widgets

Widgets is the current-account instance management surface.
It loads the current-account widget inventory and executes create/duplicate/delete/publish/rename against current-account routes only.

### Templates

Templates loads the curated starters available to the current account and clones a chosen template into the current account without browser-supplied `accountId`.

### Assets

Assets manages the current-account library only.
List/upload/delete/usage all operate on the current account.
The Roma-side product contract for assets is deterministic and current-account scoped.
Assets is intentionally boring:
- the user should never need to understand account routing to manage files
- the developer should never need to reconstruct account identity to debug a normal asset flow

### Team

Team manages the current account's members and invitations.
It does not rediscover the account on every client request.

### Usage

Usage reads current-account metering and limits.
It is a summary domain, not a second account-resolution flow.
It does not piggyback on arbitrary account routes just to rediscover storage/account context.
Where Roma needs a summary, it gets a summary contract.
It does not normalize "read a huge list and infer summary from it" as a permanent product pattern.
`GET /api/account/usage` is a required current-account route, not an optional later cleanup.

### AI

AI reads current-account AI profile/limits and current agent availability from entitlement-derived truth.
It does not own copilot execution state, provider/model routing, or agent orchestration.
San Francisco is the AI execution owner.
Roma should remain a simple policy/availability surface unless real server-owned mutable AI state later requires more.

### Settings

Settings owns current-account governance:
- locale policy
- ownership transfer
- delete account
- account-level settings

### Builder

Builder opens one `publicId` in the current account.

Rules:
- route path is instance-first
- current-account host context is resolved server-side
- Bob is not asked to rediscover or replay current-account identity back through the browser
- browser choreography must shrink to the minimum editor-host contract

---

## Scope

### In scope

- Roma current-account route layer
- Roma domain migration away from browser-supplied current-account identity
- Roma current-account helper cleanup so "no account" is explicit and typed, not encoded as empty strings
- clearer fail-closed UI states where current-account truth is unavailable
- Builder current-account host simplification
- reduction/removal of duplicated account-plumbing helpers
- explicit deletion or collapse of abstractions that only existed to replay browser account identity
- deletion of obsolete normal-product callers that still require explicit `accountId`
- making Roma's single-current-account boundary explicit in product routes and contracts
- making asset management boring and current-account deterministic at the Roma product boundary
- establishing dedicated summary/usage contracts where Roma currently piggybacks on unrelated list routes
- encoding PLG-scale shell viability as a design requirement, including the free-user base
- making today's Roma explicitly single-account excellent, with no preserved agency-style complexity
- making the Roma AI surface explicitly entitlement-derived and San-Francisco-executed
- docs updates required by the new product boundary

### Out of scope

- changing Berlin's role as auth/account truth owner
- weakening bootstrap strictness by treating missing active-account truth as a normal success case
- Roma-side fallback auto-selection of a current account when Berlin did not mint one
- building or preserving account-switching UX/contracts inside Roma
- changing DevStudio local-tool contracts except where Roma coupling must be removed
- weakening account authorization
- creating cross-account product browsing
- support/admin control-plane design
- using "we can optimize later" as justification for a chatty or redundant Roma shell contract
- turning Roma into a model-routing or agent-orchestration surface
- preserving multi-account customer behavior in today's Roma for future agency speculation

---

## Hotspots to change

Primary hotspots:

- `roma/components/use-roma-me.ts`
- `roma/components/account-api.ts`
- `roma/lib/account-authz-capsule.ts`
- `roma/components/widgets-domain.tsx`
- `roma/components/templates-domain.tsx`
- `roma/components/assets-domain.tsx`
- `roma/components/team-domain.tsx`
- `roma/components/settings-domain.tsx`
- `roma/components/usage-domain.tsx`
- `roma/components/ai-domain.tsx`
- `roma/components/builder-domain.tsx`

Primary route hotspots:

- `roma/app/api/roma/widgets/route.ts`
- `roma/app/api/roma/templates/route.ts`
- `roma/app/api/accounts/[accountId]/*`

The expected direction is not "add another wrapper".
The expected direction is "replace normal current-account callers with current-account routes and delete the duplicated path".

Expected deletion/collapse targets:
- `useRomaAccountApi(...)`, `RomaAccountApi`, and related helpers in `roma/components/account-api.ts` must be deleted or collapsed to the smallest possible signed-capsule request helper needed while that transport remains in use
- `resolveActiveRomaContext(...)` in `roma/components/use-roma-me.ts` must stop acting as a current-account resolver for normal product flows and should be deleted or reduced to the smallest display-only account summary helper if any display-only need still remains
- `UsageDomain` must stop reading storage summary from the assets list path
- Builder message contracts must stop requiring Bob to send current-account identity back for normal account-mode operations
- abstractions that existed only to wrap the wrong route shape or replay browser account identity are expected to be deleted, not cosmetically renamed

---

## Execution plan

### Slice 1 — establish the current-account route layer

Add Roma routes for ordinary current-account product actions.
These routes resolve account context server-side from the existing bootstrap/session/authz state.

Implementation rule for Slice 1:
- reuse the existing signed account-authz capsule verification pattern already used by current Roma routes
- for ordinary current-account routes, verify the request-level capsule on the server and extract `payload.accountId` there
- do not require browser-supplied `accountId`, URL `accountId`, query `accountId`, or body `accountId` to establish the current account
- remove `accountId` from normal browser contracts
- do not add a new account-resolution subsystem

Required Slice 1 routes include:
- `GET /api/account/widgets`
- `GET /api/account/templates`
- `GET /api/account/assets`
- `POST /api/account/assets/upload`
- `DELETE /api/account/assets/:assetId`
- `GET /api/account/team`
- `GET /api/account/team/invitations`
- `POST /api/account/team/invitations`
- `GET /api/account/usage`
- `GET /api/account/locales`
- `PUT /api/account/locales`

### Slice 2 — migrate normal Roma domains

Move:
- Widgets
- Templates
- Assets
- Team
- Usage
- AI
- Settings

off explicit browser-supplied `accountId` for current-account usage.

As part of the same slice:
- replace empty-string current-account sentinel values with explicit null/missing semantics in Roma helpers
- update domains to branch on explicit current-account availability, not string truthiness hacks
- stop relying on asset list endpoints as a stand-in for usage/summary contracts
- do not migrate Usage without its dedicated `/api/account/usage` summary contract in place
- keep AI account visibility bootstrap-derived unless a dedicated server-owned AI state actually exists
- remove client-side abstractions that exist only to restate account identity once domains no longer need them

### Slice 3 — shrink Builder account choreography

Builder continues to host Bob, but the normal account-mode path must stop behaving like the browser is responsible for current-account identity.
Builder must use the same boring current-account asset contract as the rest of Roma.
Builder message and host contracts must become `publicId`-first for normal product behavior:
- the browser may carry widget/editor intent
- the browser must not carry current-account identity as a normal Builder operation parameter
- Roma host routes resolve current-account context server-side and execute owner-system calls directly

### Slice 4 — isolate explicit account-targeting flows

Remove explicit `:accountId` from Roma normal customer flows.

If any explicit account-targeting routes remain elsewhere in the system, isolate them as non-Roma control-plane behavior.

### Slice 5 — delete redundant current-account plumbing

Remove obsolete query-param account routing, redundant helpers, and normal product routes that still require the browser to restate current-account identity.

---

## Acceptance criteria

1. Roma bootstrap resolves one active account and Roma domains operate from it.
2. Ordinary Roma domain calls no longer require browser-supplied `accountId`.
3. Roma current-account helpers no longer encode missing account context as `''`.
4. Widgets, Templates, Assets, Team, Usage, AI, and Settings work from current-account routes.
5. Builder can open a selected widget without needing browser-driven re-resolution of current-account identity.
6. The browser is no longer the orchestration bus for already-known current-account truth.
7. Any remaining explicit account routes are outside normal Roma customer flows and never required by Roma product domains.
8. No dual-path "old and new current-account route" tolerance remains for the normal product shell.
9. Docs are updated to reflect the boring SaaS shell rule as a canonical architecture principle.
10. Roma fail-closed states distinguish clearly between:
    - upstream bootstrap/account-context failure
    - normal current-account product loading
11. Roma contains no customer-facing account-switching dependency in its normal domain contracts.
12. DevStudio-specific behavior is not a dependency of Roma product routes or Builder host contracts.
13. Roma asset flows are current-account product flows, not browser-led account-resolution flows.
14. Tier differences are expressed through minted policy/entitlements, not through different Roma shell contracts.
15. The PRD is considered complete when the shell contract is simplified and correct, not when unrelated capacity work is done.
16. Asset management is straightforward at the Roma boundary: dedicated current-account routes, dedicated summary behavior, no Builder-only special path.
17. The resulting Roma shell contract is explicitly suitable for PLG scale across all tiers, including a very large free-user base.
18. Today's Roma is explicitly excellent at single-account operation and contains no speculative agency-style customer behavior.
19. Roma AI surface is simple: entitlement-derived profile/agent visibility in Roma, execution/model routing in San Francisco.
20. Current-account route handlers reuse the existing signed-capsule authz verification pattern instead of inventing a new account-resolution mechanism.
21. Usage no longer depends on the asset list endpoint to obtain storage/account summary data.
22. Builder account-mode message contracts no longer require Bob to send current-account identity back for normal product operations.

---

## What success looks like

The success condition is not "more explicit routing".

The success condition is:

- login works
- Roma knows the active account
- each domain just works for that account
- systems call the systems they already know
- current-account product flows feel boring again

That is the product standard this PRD restores.
