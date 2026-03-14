# PRD 065 — Berlin Account Management Level Up: Boundary Closure and Commercial Truth

Status: EXECUTED  
Date: 2026-03-12  
Owner: Product Dev Team  
Priority: P0

Snapshot notice:
- This PRD is a historical snapshot of the codebase and architecture at the time it was executed.
- It is superseded by PRD 068 and any later PRDs.
- Do not use this PRD as forward-looking architecture guidance except as historical context.

Execution closeout:
- Closed as historical snapshot on 2026-03-13.
- Any remaining corrections, hardening, or architecture work move forward through PRD 068 and later only.

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

Make account management boring, scale-safe, and SaaS-correct by closing the remaining Berlin boundary leaks: customer-writable plan truth, account/content-plane mixing, role drift, invitation exposure drift, authz contract drift, and asset-entitlement semantic drift.

---

## Core architectural correction

This PRD is not a polish pass and not routine cleanup.

It is a core architectural correction.

Historical AI implementation drift took simple product truths and turned them into hidden fallback logic, synthetic concepts, secret shortcuts, legacy compatibility contracts, and backend-shaped customer UX.

Instead of keeping the system simple, explicit, and product-shaped, the implementation repeatedly did the opposite:
- guessed when it should have known
- invented concepts the product did not define
- hid privileged behavior inside fallback logic
- kept old fields and old contracts alive as if they were still canonical
- leaked machine/backend truth into customer UI
- used local/dev shortcuts inside normal product account paths

That is not just messy engineering.

It is architectural corruption in the core identity/account layer.

PRD 65 therefore treats the fixes below as architecture changes, not optional refactors:
- remove hidden fallbacks
- remove hidden privileged behavior
- remove fake authority in local/dev product flows
- remove legacy contract drift from canonical account truth
- restore direct product meaning in account, builder, storage, and user-settings behavior

---

## What AI did wrong

The failure mode was not only bad code. It was bad thinking.

The implementation drift repeatedly replaced obvious product truth with AI-shaped abstraction and convenience logic.

Simple examples:
- user logs in, opens an account, and the product should use that account
- clicking `Edit` should open the instance
- storage should mean storage
- user settings should be about the person
- account settings should be about the account

Instead, the implementation introduced:
- hidden account-selection fallback
- hidden admin/platform special cases
- fake local/dev authority
- monthly reinterpretation of storage
- synthetic entitlements with no clean product meaning
- legacy fields still acting as canonical truth
- raw machine errors and backend identifiers shown to customers

This PRD explicitly rejects that style of implementation.

The system must not be “clever” in account truth.
It must be boring, explicit, and product-correct.

---

## Immutable product tenets

These are locked product tenets for this domain and must not be violated by future implementation:

1. A user logs in and opens an explicit account context.
2. That account owns its widgets, assets, team, billing, usage, and settings.
3. When the user clicks `Edit`, Builder opens that instance for that same account.
4. User Settings is person-scoped. Team, Assets, Billing, Usage, and account settings are account-scoped.
5. Storage means current stored account bytes, not monthly upload activity.
6. No privileged or admin behavior may be hidden inside fallback logic.
7. If the system cannot open a real account associated to the user, it must fail explicitly. It must never open a fallback account.
8. No local/dev shortcut may fabricate end-user account authority inside normal product routes.
9. No legacy compatibility field may remain canonical product truth just because it already exists.
10. No backend/debug identifier or machine error key is valid customer-facing product copy.
11. If account/auth/storage truth is missing or invalid, the system must fail explicitly rather than guess, silently default, or silently bypass.

Everything in PRD 65 is in service of locking those tenets into the codebase.

---

## Execution posture for PRD 65

This PRD executes in a pre-external-user stage.

1. Clickeen has no active external product users at the time of PRD 65 execution.
2. Therefore PRD 65 is a boundary-closure PRD, not a customer-safe gradual migration PRD.
3. Default execution mode is destructive convergence:
   - prefer deletion over preservation
   - prefer replacement over wrapping
   - prefer one canonical truth over compatibility layers
4. Do not preserve legacy runtime behavior merely to avoid breakage in internal/dev environments.
5. Compatibility bridges, dual-write paths, fallback paths, and synthetic authority are prohibited unless this PRD explicitly names them as temporary and unavoidable.
6. Physical database residue may exist temporarily only if it is inert:
   - not customer-facing
   - not used as runtime truth
   - not required by product contracts
   - not used for authorization, bootstrap, summaries, or UI rendering
7. If a legacy field or fallback still drives runtime behavior, that slice is not complete.
8. Net complexity must go down during execution. If a slice materially increases LOC or branches, the change must explicitly justify why this reduces system entropy.
9. PRD completion is measured by invariant closure across Berlin, Roma, Bob, Paris, and Tokyo, not by route count, pass count, or partial UI changes.

---

## Why this PRD exists

PRD 064 put the repo on the right core model:
- `User Profile` = person
- `Account` = workspace/business
- `Account Membership` = role inside the account
- Berlin = single identity + account API

That direction is correct.

But the current implementation still has important drift that will break scale, clarity, and future billing/commercial correctness if left in place:

1. Customer-facing account tier mutation still exists and directly changes effective entitlements.
2. Berlin tier lifecycle currently owns widget/content-plane side effects (unpublish + Tokyo mirror enforcement), which violates the boundary.
3. Active account fallback still includes an environment-specific admin-account preference instead of pure account truth.
4. Auto-provisioned first account currently reuses `userId` as `accountId`, which weakens the `user != account` boundary.
5. Team/account surfaces still allow mutation of person-scoped global profile fields.
6. Invitation listing/token exposure is broader than best-practice account management.
7. Editor-level roles can still mutate account-level locale policy.
8. The product authz capsule is minted from Berlin bootstrap but still modeled as a Paris-issued contract.
9. Paris still retains direct membership fallback behavior on some product account paths instead of fully consuming the bootstrap account authz capsule.
10. Historical AI-generated implementation drift has treated caps/budgets as a freeform abstraction space instead of consuming the canonical entitlement matrix exactly as defined.
11. Asset entitlements are wrong in both meaning and enforcement: `budget.uploads.bytes` is currently implemented as monthly upload metering instead of total account storage, and `budget.uploads.count` exists as AI-added complexity without real product meaning.
12. Builder open in Roma is still too brittle: in the current one-account cloud-dev runtime it can fail with mixed capsule/config/auth drift and leak raw machine errors instead of behaving like a boring single-account product flow.

This is not a request for a second account service or a billing platform.

It is a boundary-closure PRD:
- keep the good SaaS core model
- remove the remaining architecture drift
- keep the plan simple and boring

---

## Plain-language product truth

This PRD is deliberately simple in product terms:

1. A user logs in.
2. The user opens the account they are in.
3. That account owns its widgets, assets, team, billing, usage, and settings.
4. When the user clicks `Edit` on an instance in Roma, Builder must open that instance for that same account.
5. `User Settings` is about the person.
6. `Team`, `Assets`, `Billing`, and `Usage` are about the account.
7. Asset storage means how much the account can store right now, not how much happened to be uploaded in some calendar month.

Any implementation that teaches a different rule is wrong and must be corrected in this PRD.

---

## Historical AI drift this PRD removes

The repo currently contains several AI-shaped mistakes that must be removed rather than defended:

1. Hidden privileged fallback in core account selection.
2. Monthly reinterpretation of asset storage instead of all-time storage truth.
3. A synthetic `budget.uploads.count` entitlement that adds complexity without real product meaning.
4. Raw machine keys such as `coreui.errors.*` leaking into product UI.
5. Customer UI rendering backend/debug facts instead of human product meaning.
6. Secret fallback chains that let account auth drift onto unrelated AI or service-role secrets.
7. Local/dev shortcuts that fabricate account ownership or bypass real product auth contracts.
8. Silent “allow it / return zero” behavior when usage/metering infrastructure is missing.
9. Legacy compatibility fields continuing to define canonical person/account truth.
10. Product behavior branching on hidden admin-account special cases instead of explicit ownership rules.

PRD 65 treats these as defects, not clever abstractions and not acceptable shortcuts.

---

## Current concrete drift in code

The PRD is driven by current runtime/code truth, not abstract SaaS theory.

### 1) Customer-facing tier mutation still changes real entitlements

Current surfaces:
- [berlin/src/routes-account.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/routes-account.ts)
- [berlin/src/account-lifecycle.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-lifecycle.ts)
- [roma/app/api/accounts/[accountId]/lifecycle/plan-change/route.ts](/Users/piero_macpro/code/VS/clickeen/roma/app/api/accounts/[accountId]/lifecycle/plan-change/route.ts)
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)

Current bad behavior:
- owner-facing product routes can still mutate `accounts.tier`
- Berlin then resolves the active account policy/entitlements directly from that persisted tier

### 2) Berlin tier lifecycle still owns content-plane behavior

Current surface:
- [berlin/src/account-lifecycle.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-lifecycle.ts)

Current bad behavior:
- Berlin loads published widget instances
- Berlin unpublishes instances on tier drop
- Berlin enqueues Tokyo mirror jobs directly

That violates the boundary locked in PRD 064.

### 3) Active-account fallback still contains environment-specific behavior

Current surface:
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)

Current bad behavior:
- if `active_account_id` is missing, bootstrap can still prefer the environment admin account before using deterministic membership truth
- that is a horrific hidden rule in core account selection because it privileges the admin/platform account as a secret fallback
- even though current cloud-dev is intentionally collapsed to one effective admin account, this logic is still unacceptable in core account truth and must be deleted before multi-account reality returns

### 4) First-account provisioning still weakens `user != account`

Current surface:
- [berlin/src/account-reconcile.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-reconcile.ts)

Current bad behavior:
- auto-created first account still uses `userId` as `accountId`

### 5) Team/account surfaces still cross into person-profile ownership

Current surfaces:
- [berlin/src/routes-account.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/routes-account.ts)
- [berlin/src/account-members.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-members.ts)
- [berlin/src/user-profiles.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/user-profiles.ts)

Current bad behavior:
- standard account-team routes still let account admins mutate another person’s canonical profile fields

### 6) Invitation exposure is broader than boring SaaS account management

Current surfaces:
- [berlin/src/routes-account.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/routes-account.ts)
- [berlin/src/account-invitations.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-invitations.ts)

Current bad behavior:
- invitation listing is not manager-scoped in the route layer
- invitation payloads currently expose `acceptToken`

### 7) Account locale policy mutation is still too permissive

Current surface:
- [berlin/src/account-locales.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-locales.ts)

Current bad behavior:
- current gate denies only `viewer`, which means `editor` can still mutate account locale policy/settings

### 8) Authz contract ownership still teaches the wrong service model

Current surfaces:
- [packages/ck-policy/src/authz-capsule.ts](/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/authz-capsule.ts)
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)
- [paris/src/shared/account-auth.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/shared/account-auth.ts)
- [bob/lib/account-authz-capsule.ts](/Users/piero_macpro/code/VS/clickeen/bob/lib/account-authz-capsule.ts)

Current bad behavior:
- Berlin mints the account authz capsule in runtime
- the shared contract still declares it Paris-issued
- Paris still falls back to direct membership lookup on product account paths when the capsule is absent

### 9) User Settings still renders backend/debug-shaped data instead of a human product contract

Current surfaces:
- [roma/components/profile-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/profile-domain.tsx)
- [roma/app/(authed)/domain-page-shell.tsx](/Users/piero_macpro/code/VS/clickeen/roma/app/(authed)/domain-page-shell.tsx)
- [roma/components/roma-shell.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/roma-shell.tsx)
- [berlin/src/auth-session.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/auth-session.ts)

Current bad behavior:
- the person-scoped surface is still framed as `My Profile` instead of `User Settings`
- the page exposes raw internal/debug facts such as user ids, membership counts, service-owner copy, provider subjects, and identity ids
- Roma can render raw machine error keys such as `coreui.errors.*` directly into the UI
- the field model itself is still wrong for the product:
  - `display name` instead of `first name` + `last name`
  - `preferred language` instead of `Primary Language`
  - `country code` instead of `Country`
  - visible linked-identity inventory instead of user-facing communication/security settings

### 10) Roma is missing shared form primitives for person/team/settings forms

Current surfaces:
- [roma/components/profile-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/profile-domain.tsx)
- [roma/components/team-member-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/team-member-domain.tsx)
- [roma/app/roma.css](/Users/piero_macpro/code/VS/clickeen/roma/app/roma.css)

Current bad behavior:
- product surfaces already use shared class names such as `roma-form-grid` and `roma-field`
- Roma does not define those shared primitives in app-wide CSS
- the result is broken form layout that reads like unfinished scaffolding

### 11) Asset/storage entitlement semantics are wrong and currently dangerous

Current surfaces:
- [packages/ck-policy/entitlements.matrix.json](/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/entitlements.matrix.json)
- [packages/ck-policy/src/registry.ts](/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/registry.ts)
- [packages/ck-policy/src/gate.ts](/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/gate.ts)
- [roma/components/assets-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/assets-domain.tsx)
- [tokyo-worker/src/domains/assets.ts](/Users/piero_macpro/code/VS/clickeen/tokyo-worker/src/domains/assets.ts)
- [tokyo-worker/src/domains/assets-handlers.ts](/Users/piero_macpro/code/VS/clickeen/tokyo-worker/src/domains/assets-handlers.ts)

Current bad behavior:
- historical AI-generated implementation added `budget.uploads.count` and treated `budget.uploads.bytes` as monthly metering instead of total account storage truth
- runtime currently meters uploads by UTC month and resets budget enforcement each month, even though assets persist until deleted
- the current implementation therefore allows long-lived accounts to accumulate effectively unbounded all-time storage simply by continuing to upload month after month
- the `Assets` page compounds the problem by mixing persistent library state with monthly upload-budget counters in a way that reads like one coherent storage truth
- the intended product meaning is simple:
  - `budget.uploads.bytes` = total storage available to the account, all-time, across currently stored assets
  - `budget.uploads.count` = remove; it has no clean product meaning and only adds artificial complexity
  - `uploads.size.max` = keep only as the per-file operational cap
- no engineer or AI agent may introduce or reinterpret customer-facing asset/storage semantics outside the explicit matrix and PRD truth

### 12) Builder open is still brittle in the current one-account product shell

Current surfaces:
- [roma/components/builder-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/builder-domain.tsx)
- [roma/app/api/accounts/[accountId]/instance/[publicId]/route.ts](/Users/piero_macpro/code/VS/clickeen/roma/app/api/accounts/[accountId]/instance/[publicId]/route.ts)
- [roma/app/api/accounts/[accountId]/instances/[publicId]/localization/route.ts](/Users/piero_macpro/code/VS/clickeen/roma/app/api/accounts/[accountId]/instances/[publicId]/localization/route.ts)
- [bob/lib/account-authz-capsule.ts](/Users/piero_macpro/code/VS/clickeen/bob/lib/account-authz-capsule.ts)
- [paris/src/shared/account-auth.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/shared/account-auth.ts)

Current bad behavior:
- current cloud-dev product reality is one effective admin account; Builder open should therefore be the simplest possible account flow
- instead, Builder open can fail with mixed `403` / `500` results across the instance and localization paths because the account auth capsule/config contract is still brittle between Roma, Bob, and Paris
- the same user action can surface `coreui.errors.misconfigured`, `coreui.errors.auth.forbidden`, or similar machine keys directly in Roma UI
- this is not acceptable product behavior in any environment, and it is especially unacceptable in the current one-account cloud-dev shape where there is no legitimate user-facing account ambiguity to explain away
- Builder account-open/save/localization must behave as one boring account contract:
  - one active account context
  - one accepted capsule contract
  - one consistent verification result
  - one human-readable user-facing failure mode when infrastructure is broken

Plain-language product rule:
- the user is already in the only account that matters in current cloud-dev
- clicking `Edit` must therefore either open the instance or show one human message that Builder is temporarily unavailable
- the product must never make the user reason about capsule drift, account ambiguity, or internal auth configuration

### 13) Account auth capsule secret resolution still has hidden cross-secret fallback

Current surfaces:
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)
- [paris/src/shared/authz-capsule.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/shared/authz-capsule.ts)
- [bob/lib/account-authz-capsule.ts](/Users/piero_macpro/code/VS/clickeen/bob/lib/account-authz-capsule.ts)

Current bad behavior:
- account auth capsule verification/signing still falls back from `ROMA_AUTHZ_CAPSULE_SECRET` to `AI_GRANT_HMAC_SECRET`
- if that is also absent, it falls back again to `SUPABASE_SERVICE_ROLE_KEY`
- this couples account auth proof to unrelated root secrets and makes account auth ownership/configuration unclear

### 14) Local/dev product routes still contain synthetic ownership and service-role bypasses

Current surfaces:
- [paris/src/shared/account-auth.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/shared/account-auth.ts)
- [bob/lib/account-authz-capsule.ts](/Users/piero_macpro/code/VS/clickeen/bob/lib/account-authz-capsule.ts)
- [bob/lib/michael.ts](/Users/piero_macpro/code/VS/clickeen/bob/lib/michael.ts)
- [tokyo-worker/src/index.ts](/Users/piero_macpro/code/VS/clickeen/tokyo-worker/src/index.ts)
- [tokyo-worker/src/domains/assets-handlers.ts](/Users/piero_macpro/code/VS/clickeen/tokyo-worker/src/domains/assets-handlers.ts)

Current bad behavior:
- Paris can still grant owner authority on the admin account in dev/trusted mode without a real principal-bound account capsule
- Bob can still fabricate a synthetic local-dev owner capsule on standard product routes
- Bob local can still jump directly to Supabase service-role access for Michael from a trusted local token
- Tokyo can still treat a trusted dev token as sufficient and skip real membership/account authorization on account asset paths

These are not harmless conveniences. They teach a second hidden auth system.

### 15) Usage and entitlement enforcement can still silently disable itself

Current surfaces:
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)
- [paris/src/shared/budgets.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/shared/budgets.ts)
- [tokyo-worker/src/domains/assets.ts](/Users/piero_macpro/code/VS/clickeen/tokyo-worker/src/domains/assets.ts)

Current bad behavior:
- if `USAGE_KV` is missing in local, usage reads silently return `0` and budget consumption silently allows writes
- this means local can drift into fake “everything passes” behavior without an explicit product decision

### 16) Canonical user/account truth still depends on legacy compatibility fields

Current surfaces:
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)
- [berlin/src/account-reconcile.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-reconcile.ts)
- [berlin/src/user-profiles.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/user-profiles.ts)
- [roma/components/profile-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/profile-domain.tsx)
- [roma/lib/domains.ts](/Users/piero_macpro/code/VS/clickeen/roma/lib/domains.ts)

Current bad behavior:
- Berlin bootstrap/profile normalization still depends on `display_name`
- reconcile/profile patch contracts still preserve `display_name`, `preferred_language`, and `country_code` as first-class writable truth
- Roma shell/domain copy still teaches `Profile` and linked identities as a primary customer concept

### 17) Platform/curated behavior still depends on admin-account special-casing

Current surfaces:
- [paris/src/domains/roma/widgets-bootstrap.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/roma/widgets-bootstrap.ts)
- [paris/src/domains/account-instances/read-handlers.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/account-instances/read-handlers.ts)
- [paris/src/domains/l10n/account-handlers.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/l10n/account-handlers.ts)
- [paris/src/domains/l10n/layers-handlers.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/l10n/layers-handlers.ts)
- [paris/src/domains/roma/handoff-account-create.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/roma/handoff-account-create.ts)

Current bad behavior:
- multiple product/account paths still branch on `accountId === adminAccountId`
- platform-owned curated behavior is therefore encoded as hidden admin-account privilege instead of explicit source/platform ownership rules

### 18) Invalid persisted account policy/state can still silently default

Current surfaces:
- [berlin/src/account-locales.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-locales.ts)
- [berlin/src/account-state.ts](/Users/piero_macpro/code/VS/clickeen/berlin/src/account-state.ts)

Current bad behavior:
- invalid persisted account locale policy can fall back to default policy
- missing/invalid legacy profile fields can still collapse canonical bootstrap/profile truth unexpectedly
- this hides corrupted persisted state instead of surfacing an operator defect that must be repaired

---

## Required review answers

### 1) Elegant engineering and scalability

Yes, if we do this by tightening the existing model instead of adding new systems.

This PRD keeps:
- one identity owner
- one account API owner
- one membership model
- one entitlement-resolution model
- one bootstrap truth

It removes special cases and cross-boundary behavior from the hot path.

### 2) Compliance to architecture and tenets

Yes.

This PRD moves the implementation closer to:
- Berlin as single account-truth boundary
- Michael as persistence plane, not product account API
- Roma as customer shell only
- Bob as consumer of account truth only
- Paris as policy/orchestration/content-plane aftermath owner, not account owner

### 3) Avoid overarchitecture and unnecessary complexity

Yes.

This PRD does **not** introduce:
- a billing service
- a second entitlement service
- an account event bus
- a generic orchestration engine
- a separate “commercial truth” microservice
- a second profile system

It tightens existing contracts instead.

### 3b) Avoid academic abstractions, meta-work, and gold-plating

Yes.

The PRD is concrete:
- exact route/role changes
- exact ownership changes
- exact fallback deletions
- exact acceptance gates

We are not building speculative billing or connector abstractions here.

### 4) Keep the plan simple and boring

Yes.

The final model after this PRD should be easy to explain:
- Berlin owns identity, profile, account, membership, active-account selection, and entitlement bootstrap.
- Customer-facing plan truth is not self-editable.
- Berlin does not own widget/content aftermath.
- Roma and Bob consume Berlin bootstrap + account authz capsule only.
- Paris owns content-plane aftermath and remaining product account-path orchestration where required.

That is the boring SaaS model this repo should converge to.

---

## Decision (locked)

Hard rule for PRD 65:
- the entitlement matrix is hard truth
- [packages/ck-policy/entitlements.matrix.json](/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/entitlements.matrix.json) and its typed registry are the canonical source for customer-facing caps, flags, and budgets
- this PRD explicitly changes the asset-related matrix truth:
  - `budget.uploads.bytes` becomes total account storage bytes
  - `budget.uploads.count` is removed
- no AI-generated implementation, UI copy, or product logic may invent a new entitlement concept or reinterpret an existing token outside that matrix
- downstream code/UI must follow the changed matrix exactly after the matrix update lands

### 1) Keep the canonical SaaS account model

The canonical model stays:
- `Identity` = login/provider credential
- `User Profile` = person
- `Account` = workspace/business/customer boundary
- `Membership` = that person’s role in that account
- `Commercial input` = account plan/tier/billing state
- `Entitlements` = Berlin-resolved effective capability snapshot for the active `user x account`

Hard rule:
- roles do not replace entitlements
- entitlements do not replace roles
- effective capability = `membership role x Berlin-resolved entitlements`

### 2) Berlin remains the single identity and account API

Berlin owns:
1. identity/session
2. user profile
3. account bootstrap
4. active account resolution
5. account settings/membership/invitation API
6. effective entitlement snapshot resolution

Berlin must **not** own:
1. widget publish/unpublish
2. Tokyo mirror enforcement
3. instance save aftermath
4. content-plane downgrade cleanup logic
5. builder business logic

### 3) Customer-facing plan truth is no longer self-mutable

Current drift:
- owner-facing product routes can mutate `accounts.tier`
- Berlin then resolves product entitlements directly from that write

That is not acceptable SaaS architecture.

Locked rule:
- customer product surfaces must not directly mutate account commercial truth
- Roma must not expose customer-facing plan-change actions
- Berlin public customer routes must not accept customer-driven tier mutation as normal product behavior

Practical rule for this phase:
- until real billing/commercial integration exists, customer-facing plan/tier mutation is frozen
- account tier remains readable product state
- internal environment/operator changes can continue only through explicit non-customer paths

### 4) Berlin commits account truth only; Paris owns tier/content aftermath

Current drift:
- Berlin tier lifecycle computes published-instance caps and drives unpublish/Tokyo mirror behavior

Locked rule:
- Berlin commits account truth
- if that truth change requires widget/content-plane enforcement, Berlin triggers explicit Paris internal aftermath after commit
- Paris owns all real content-plane execution

For this PRD:
- account locale aftermath pattern becomes the model for account tier aftermath
- Berlin may trigger aftermath
- Berlin may not itself become the content-plane executor

### 5) Active account truth must be pure account truth

Locked rule:
- primary source: `user_profiles.active_account_id`
- if missing or invalid, fallback is deterministic membership ordering only
- no environment-specific admin-account preference is allowed in default account selection
- no privileged/platform/admin account may ever be treated as a hidden default-selection escape hatch
- if no real account associated to the user can be opened, the system must fail explicitly instead of opening any fallback account

Why this is severe:
- account selection is core identity truth, not a convenience layer
- privileged hidden fallback corrupts the answer to the most basic product question: "which account did the user open?"
- environment-specific privileged fallback is exactly the kind of AI/dev shortcut that stays invisible until it becomes a security/data-isolation incident

Deterministic fallback order:
1. persisted active account if valid
2. highest membership role (`owner > admin > editor > viewer`)
3. oldest membership by `created_at`
4. stable final tie-breaker by `account_id`

### 6) First-account provisioning must preserve `user != account`

Locked rule:
- first auto-created account gets its own UUID
- auto-provision must not reuse `userId` as `accountId`

The account may still default to a simple initial name such as `Personal`, but identity and account ids must stay distinct.

### 7) Role semantics must be boring and enforced consistently

Locked rule:
- `viewer`: read-only account participation
- `editor`: content editing only
- `admin`: team/account operations
- `owner`: final account-holder powers

Therefore:
- account-level locale policy/settings are `admin|owner` only
- invitation issue/list/revoke are `admin|owner` only
- owner transfer and account delete remain owner-only
- tier-drop dismissal is not a viewer/editor action

### 8) Team surface must not mutate global person profile truth

Locked rule:
- team/account surfaces manage membership
- person-scoped profile remains on `/me`

Therefore:
- the standard product-facing `PATCH /v1/accounts/:id/members/:memberId/profile` path is removed from the normal customer/member shell contract
- customer admins manage roles/memberships, not another person’s canonical global identity/profile
- Team continues to own privilege and role mutation for memberships; what is removed is global profile editing through Team, not membership administration

If future support/operator workflows need profile intervention, that belongs in explicit DevStudio/operator scope, not standard account team UX.

### 9) Invitation exposure must be manager-scoped and token-safe

Locked rule:
- invitation list is manager-scoped (`admin|owner`)
- invitation accept remains the canonical attach path for unknown people
- invitation tokens are treated as opaque acceptance credentials, not general account metadata

For this phase:
- no viewer/editor invitation list access
- no token exposure in non-manager flows
- manager surfaces may return the manual accept URL/token because delivery infrastructure is not yet shipped

### 10) The account authz capsule becomes Berlin-owned truth

Current drift:
- Berlin bootstrap mints the account authz capsule
- shared package contract still models it as Paris-issued `roma.account`

Locked rule:
- the bootstrap account authz capsule must be modeled as Berlin-owned account-context truth
- naming, issuer semantics, and verifier contract must match runtime reality

Practical rule:
- shared verification may remain in `packages/ck-policy`
- issuance ownership and token semantics must no longer teach the wrong service model

### 11) Paris product account auth becomes capsule-first with no membership fallback

Locked rule:
- product-path account routes in Paris consume the bootstrap account authz capsule
- direct membership lookups are not the normal product-path auth model after bootstrap
- any remaining direct membership reads must be explicit internal/support exceptions, not silent product fallback

### 12) The person-scoped surface is User Settings, not backend diagnostics

Locked rule:
- the person-scoped surface is `User Settings`
- the global app bar remains a shell concern and is not a PRD 65 domain-specific problem
- the page must not expose raw internal/debug identifiers or architecture copy in normal customer UI
- linked identities remain an internal Berlin auth/account model; they are not exposed as a standard customer-facing User Settings surface
- machine error keys such as `coreui.errors.*` are contract values, not user-facing copy
- shared Roma form primitives belong in app-wide Roma CSS, not in ad-hoc per-domain styling

For this PRD:
- rename/copy/error presentation and the canonical User Settings model are in scope

### 13) Canonical User Settings model

Locked rule:
- the customer-facing fields are:
  - `First name`
  - `Last name`
  - `Primary Language`
  - `Country`
  - `Timezone`
  - `Email`
  - `Phone`
  - `WhatsApp`
- `display name` is not a customer-facing field; if retained temporarily in persistence, it becomes a derived compatibility field, not a source-of-truth input
- `First name` is the default salutation source for product copy, emails, and dashboard greetings
- `Primary Language` is the language used for UI and communication defaults
- `Country` is user-facing; canonical persistence may still use an ISO country code internally, but the product never exposes a raw country-code field
- `Timezone` is derived from `Country` and becomes user-editable only when that country has multiple supported timezones
- `Email` is changeable, but email change remains auth-owned:
  - Berlin owns the customer flow
  - Supabase Auth remains the underlying identity/email-change system
  - `user_profiles.primary_email` is a mirrored product field, not the system-of-record for identity email
- `Phone` and `WhatsApp` are user contact methods, not linked identities
- `Phone` and `WhatsApp` must be verified before they become active/usable product channels

Verification rule:
- Berlin owns one standard user-contact verification contract for `phone` and `whatsapp`
- verification UX is a standard code-entry modal/popup
- Berlin owns challenge creation, TTL, attempt limits, and final verified-state mutation
- message delivery is delegated to the separate communications delivery boundary `Vienna`
- `Vienna` remains backburnered / non-executing in the current repo state, so PRD 65 must not depend on Vienna implementation landing first
- this PRD does not assign communications delivery to Berlin
- this PRD does not assign communications delivery to San Francisco; San Francisco remains the AI runtime
- local may use a delivery-capture adapter for development, but must not bypass the verification lifecycle
- cloud-dev/prod must not pretend verification works without a real delivery dependency

### 14) Asset entitlements are corrected to real storage truth

Locked rule:
- `budget.uploads.bytes` means total storage available to the account
- it is not a monthly meter
- it is not an upload-activity counter
- it is the maximum bytes the account may have stored right now across all account-owned assets
- `budget.uploads.count` is removed from the entitlement model
- `uploads.size.max` remains as the per-file upload cap

Upload enforcement rule:
- upload is allowed only if:
  - the file passes `uploads.size.max`
  - and `current stored asset bytes + incoming file size <= budget.uploads.bytes.max`
- if `budget.uploads.bytes.max` is `null`, storage is unlimited
- delete naturally frees storage because stored bytes go down when the asset is removed
- there is no monthly reset for asset storage entitlement
- there is no separate synthetic “refund” model for storage; availability comes from actual currently stored bytes

Storage truth rule:
- canonical storage-used truth is exact stored asset bytes for that account
- phase 1 implementation may compute this from canonical asset manifest metadata (`sizeBytes`) at the upload authority
- PRD 65 must not introduce a second speculative asset-usage truth model just to patch this quickly
- if a future optimization/cache is needed, it must remain derived from the canonical asset metadata truth, not replace it

Product/UI rule:
- `Assets` primarily shows asset library state plus storage truth
- customer-facing storage language must be:
  - storage used
  - storage limit
  - per-file upload limit
- `Assets` must not show monthly upload counters for storage because storage is not a monthly concept
- if usage/billing surfaces later show storage entitlement, they must use the same all-time storage meaning

### 15) Builder open must be boring in the one-account cloud-dev runtime

Locked rule:
- in the current cloud-dev product shape, Roma/Bob/Paris must treat Builder open as a single-account flow against the surviving admin account
- Builder open must not depend on hidden account-selection tricks
- Builder open must not produce mixed auth outcomes for the same request family (`instance`, `localization`, save commands)
- if the account auth capsule/config is broken, the failure is an operator/infrastructure problem, not a user-facing domain concept

Product rule:
- current one-account cloud-dev users should never have to reason about account ambiguity when clicking `Edit`
- clicking `Edit` on an instance in Roma must either:
  - open the instance successfully
  - or fail with one clear human message that the editor is temporarily unavailable
- raw machine keys such as `coreui.errors.misconfigured` or `coreui.errors.auth.forbidden` must never be rendered as the customer explanation for Builder open failure

System rule:
- Roma, Bob, and Paris must consume one aligned account auth capsule contract for Builder open/save/localization
- the same capsule must not verify as acceptable on one path and misconfigured/forbidden on another for the same product flow
- if required env/config for capsule verification is missing, that is a deployment/configuration defect to surface in logs/observability, not a machine key to leak into product UI

### 16) Account auth secret ownership must be singular and explicit

Locked rule:
- account auth capsule signing/verification uses one dedicated secret: `ROMA_AUTHZ_CAPSULE_SECRET`
- account auth capsule code must not fall back to `AI_GRANT_HMAC_SECRET`
- account auth capsule code must not fall back to `SUPABASE_SERVICE_ROLE_KEY`

Why:
- account auth proof is not AI grant proof
- account auth proof is not database root access
- hidden cross-secret fallback makes security ownership unclear and makes misconfiguration harder to detect

### 17) Local/dev shortcuts must never fabricate end-user account authority

Locked rule:
- local development may keep explicit dev-only adapters where required
- but standard product account routes must not:
  - fabricate synthetic owner capsules
  - grant owner on the admin account because a request is “dev”
  - convert an end-user token into direct service-role access
  - skip membership/account authorization on normal account product paths

Why:
- a local convenience that fabricates authority teaches a second account system
- once that exists, future code begins relying on hidden fake authority instead of real account truth

### 18) Usage enforcement must fail explicitly, not silently disappear

Locked rule:
- if a runtime path depends on usage/budget/storage enforcement, missing backing infrastructure must be explicit
- local may use an explicit local implementation
- local may disable a dependent feature explicitly
- local must not silently return zero usage or allow writes purely because a binding is missing
- non-authoritative warm mirrors may remain best-effort only when their absence cannot change product write authorization, storage enforcement, or customer-visible account truth

Why:
- silent no-op enforcement creates fake confidence and invalidates product testing
- product behavior must stay explainable across environments

### 19) Canonical person/account contracts must not depend on legacy compatibility fields

Locked rule:
- `display_name`, `preferred_language`, and `country_code` may remain temporarily only as derived compatibility fields if needed
- they must not remain required bootstrap truth
- they must not remain the primary writable customer contract

Why:
- back-compat fields are acceptable only as a temporary translation layer
- when old fields remain canonical, architecture cleanup never actually finishes

### 20) Platform-owned behavior must be explicit, not inferred from admin-account identity

Locked rule:
- curated/platform-owned behavior must be modeled explicitly by source/ownership/platform rules
- product account auth must not keep branching on `accountId === adminAccountId` to decide what is allowed

Why:
- hidden admin-account branching is just another privileged fallback
- platform ownership is a domain rule and must be explicit in the contract

### 21) Invalid persisted account state must surface as an operator defect

Locked rule:
- invalid persisted account locale/policy/profile truth must not be silently healed inside canonical product/account paths
- if state is invalid, the system must fail explicitly, log clearly, and force repair

Why:
- silent defaulting hides corruption
- hidden healing turns real data defects into future behavior drift

---

## Concrete implementation changes

### ck-policy / entitlement matrix

1. Change `budget.uploads.bytes` semantics and description to total account storage bytes.
2. Remove `budget.uploads.count` from:
   - entitlement matrix
   - typed registry
   - policy typing/helpers
   - any product copy/docs that present it as customer truth
3. Keep `uploads.size.max` as the per-file cap.
4. Remove any gate logic that treats upload-count budget as a product entitlement requirement.
5. Keep account auth capsule type/issuer semantics aligned with Berlin-owned runtime truth; shared packages must not preserve Paris-issued terminology as compatibility folklore.

### Tokyo-worker

1. Remove monthly upload-count enforcement.
2. Remove monthly upload-bytes metering for asset storage enforcement.
3. Enforce uploads against:
   - `uploads.size.max`
   - `current stored bytes + incoming file size <= budget.uploads.bytes.max`
4. Use canonical asset metadata/storage truth to determine current stored bytes.
5. Delete the month-keyed asset-storage enforcement path; asset storage is not a monthly budget.
6. After asset delete, available storage must increase naturally because current stored bytes decrease.
7. Remove trusted end-user bypass from standard account asset routes; a dev token must not be enough to skip real membership/account authorization.
8. If local development needs an internal shortcut, keep it on explicit internal service paths only; normal product uploads still use the real account contract.
9. Missing usage/storage enforcement infrastructure must not silently allow writes; local must use an explicit local implementation or fail unavailable.

### Berlin

1. Remove environment-specific admin fallback from active-account selection.
2. Change first-account auto-provision to use a new account UUID.
3. Tighten locale mutation to `admin|owner` only.
4. Tighten invitation listing to `admin|owner` only.
5. Tighten tier-drop dismiss role gating to `admin|owner` or `owner` only; the implementation must pick one and keep it explicit across docs/UI.
6. Freeze customer-facing tier mutation:
   - Roma customer shell no longer exposes it
   - Berlin public customer path no longer behaves as normal owner self-service commercial mutation
7. Remove Berlin-owned widget/content aftermath from tier lifecycle.
8. Add/extend explicit internal aftermath contract for tier changes in Paris.
9. Remove the standard customer-facing member-profile patch route from the product account boundary.
10. Rename/realign account authz capsule issuer/contract so Berlin is the owner.
11. Replace the customer-facing self-profile contract so `given_name` + `family_name` are the source of truth and `display_name` is no longer an editable product field.
12. Keep linked identities internal to Berlin; do not treat them as a normal customer-facing User Settings contract.
13. Add a Berlin-owned email-change flow backed by Supabase Auth change-email confirmation; do not let product code mutate `user_profiles.primary_email` directly.
14. Add a Berlin-owned verified contact-method contract for `phone` and `whatsapp`, including verification challenge lifecycle and explicit handoff to Vienna when Vienna exists.
15. Treat privileged hidden fallback in default account selection as a defect, not a temporary convenience. Delete it fully from bootstrap account resolution.
16. Require a dedicated account auth capsule secret and delete all fallback resolution to AI or service-role secrets.
17. Remove `display_name`, `preferred_language`, and `country_code` from canonical writable/bootstrap truth; if temporarily retained, keep them derived only.
18. Make invalid persisted profile/account policy state an explicit operator defect instead of silently defaulting inside canonical account flows.

### Roma

1. Remove customer-facing plan-change actions from Settings/account UI.
2. Remove team UI actions that mutate another person’s canonical global profile.
3. Ensure account locale/settings surfaces are hidden/disabled for editor role.
4. Rename the person-scoped surface from `My Profile` to `User Settings`.
5. Remove raw debug/system copy from User Settings:
   - no raw user id
   - no membership-count diagnostics
   - no service-owner copy such as "Berlin owns..."
6. Remove linked-identities inventory from standard customer User Settings UI.
7. Replace the current field set with the canonical User Settings field set:
   - `First name`
   - `Last name`
   - `Primary Language`
   - `Country`
   - `Timezone`
   - `Email`
   - `Phone`
   - `WhatsApp`
8. Remove product-facing `Display name`, `Preferred language`, and `Country code` inputs from User Settings.
9. Make `Country` the user-facing selection and derive `Timezone` from it; show a timezone dropdown only when the selected country has multiple supported timezones.
10. Add phone and WhatsApp add/verify UX with a standard code-entry modal/popup.
11. Consume verification state from Berlin only; message delivery implementation remains outside Roma and outside PRD 65. Vienna is the intended communications boundary, but Vienna is not a dependency for this execution slice.
12. Normalize product error rendering so raw `coreui.errors.*` values are never shown directly to the user.
13. Add shared Roma form primitives in `roma/app/roma.css` for user/team/settings forms; do not solve the broken layout with per-domain CSS hacks.
14. Continue to proxy Berlin account routes as thin same-origin relays only.
15. On account/product surfaces that render entitlements, treat matrix semantics as literal truth:
   - `uploads.size.max` = per-file limit
   - `budget.uploads.bytes` = total account storage limit
16. Remove product-facing upload-count budget language and UI because `budget.uploads.count` is removed.
17. On `Assets`, show:
   - current storage used
   - storage limit
   - per-file upload limit
18. Do not present storage as a monthly concept anywhere in Roma.
19. Builder open failure must never surface raw machine reason keys in the customer UI.
20. In the current one-account cloud-dev runtime, Builder edit/open must behave like a boring single-account flow and must not rely on hidden fallback logic or capsule ambiguity.
21. When Builder infrastructure/auth contract is broken, Roma must show one clear human message and retain detailed machine reasons only in logs/observability.
22. Rename navigation/shell copy so the customer concept is `User Settings`, not `Profile`, and remove linked-identity language from standard customer navigation/description.
23. Remove any remaining product copy that teaches hidden admin-account, backend-debug, or legacy field semantics.

### Bob

1. Continue consuming bootstrap and capsule only.
2. Do not gain any new account-management responsibility.
3. Update shared capsule contract naming/issuer validation after cutover.
4. Builder open/save flows must not depend on a second implicit account-auth model beyond the aligned bootstrap capsule contract.
5. Remove synthetic local-dev owner capsule bypass from standard account product routes.
6. Remove direct service-role Michael access from end-user local product flows; local must still use the same explicit Michael/Berlin auth contract or a dedicated internal-only dev contract.
7. Remove implicit `account -> free` dev policy remap; local dev policy must come from real bootstrap truth or an explicit test fixture, not a hidden fallback.

### Paris

1. Add/extend explicit internal account tier aftermath endpoint.
2. Remove direct membership fallback from remaining product account paths that should already be capsule-authenticated.
3. Keep any remaining direct-membership auth strictly explicit for internal/support flows only.
4. Builder localization/save-related account paths must verify the same capsule contract consistently with Roma/Bob product routes.
5. Remove admin-account owner grant from dev/trusted account auth on standard product routes.
6. Product account auth must never derive end-user authority purely from internal-service/dev trust markers.
7. Replace `accountId === adminAccountId` product branching for curated/platform behavior with explicit platform/source ownership rules.
8. Missing usage infrastructure for product budget enforcement must not silently disable enforcement.

### DevStudio

1. If an internal/operator tier mutation path is still required before billing exists, keep it DevStudio/operator-scoped only.
2. Do not reintroduce a second account truth model.

---

## Execution dependency sweep (easy-to-miss residue)

The sections above define the required runtime changes.
The items below are concrete dependencies that are easy to miss during execution because they sit in secondary routes, docs, tooling, or transitional flows.

### 1) Final account-holder flows still depend on old Settings/account assumptions

These flows are part of the account-management surface and must move with PRD 065, not be treated as unrelated settings cleanup:
- `berlin/src/account-governance.ts`
- `roma/components/settings-domain.tsx`
- `roma/app/api/accounts/[accountId]/owner-transfer/route.ts`
- `roma/app/api/accounts/[accountId]/route.ts`

Why this matters:
- owner transfer and delete account are the final account-holder powers
- they currently sit in the same Roma Settings surface that still teaches old tier/profile/account semantics
- `berlin/src/account-governance.ts` still contains admin-account special-case behavior for delete-account denial, so platform ownership rules and final account-holder rules will drift if this slice is not executed together

### 2) Linked-identity / old-profile residue exists beyond the visible page

Removing linked identities and old person fields from customer UX is not just a `profile-domain.tsx` edit.
Execution must also account for:
- `roma/app/api/me/identities/route.ts`
- `roma/components/use-roma-me.ts`
- `roma/lib/domains.ts`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/Overview.md`
- `documentation/services/roma.md`
- `documentation/services/berlin.md`

Why this matters:
- if `/api/me/identities` and the old typed bootstrap/profile contracts remain undocumented or alive without intent, future work will quietly reintroduce linked-identity inventory and old field semantics
- docs currently still teach `Profile`, `displayName`, `preferredLanguage`, `countryCode`, and linked-identity visibility as normal customer contract

### 3) Asset entitlement correction has tooling and documentation residue outside runtime code

Changing asset/storage semantics requires more than `ck-policy`, `Tokyo-worker`, and `Roma Assets`.
Execution must also account for:
- `admin/src/html/tools/entitlements.html`
- `documentation/capabilities/multitenancy.md`
- `documentation/widgets/_templates/SubjectPolicyMatrices.md`
- widget PRDs that currently teach `budget.uploads.count`, including:
  - `documentation/widgets/Countdown/Countdown_PRD.md`
  - `documentation/widgets/InstagramFeed/InstagramFeed_PRD.md`

Why this matters:
- if DevStudio/admin tooling still shows upload-count budgets and monthly upload-bytes semantics, operators will keep editing the wrong model
- if widget PRDs and capability docs still teach `budget.uploads.count`, AI execution will re-add the removed entitlement later

### 4) Canonical docs are still teaching PRD 064 truth and will re-seed the wrong architecture if not updated together

Execution must explicitly update:
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/Overview.md`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/paris.md`
- `documentation/services/bob.md`
- `documentation/services/devstudio.md`
- `documentation/services/michael.md`
- `documentation/services/tokyo-worker.md`
- `documentation/capabilities/multitenancy.md`

Why this matters:
- docs are operational truth in this repo
- several of these docs still teach PRD 064 ownership, `Profile`/linked-identity UI, admin-account special-casing, `budget.uploads.count`, secret fallback behavior, or Berlin-owned content-plane cleanup

### 5) Minibob handoff / account-creation aftermath still carries admin-account special casing

This dependency is easy to miss because it sits in a login/continuation path, not in the visible account shell.
Execution must account for:
- `paris/src/domains/roma/handoff-account-create.ts`
- `roma/app/api/session/finish/route.ts`
- `roma/app/login/page.tsx`

Why this matters:
- `signup_minibob_publish` still depends on a Paris handoff completion flow with admin-account gating
- if admin-account special casing is removed elsewhere but not here, cloud-dev account creation/publish handoff will become a hidden broken path
- this flow also still teaches `coreui.errors.account.createFailed` / minibob-handoff recovery behavior and must stay aligned with the corrected one-account/account-bootstrap truth

### 6) Platform/admin-account identity still leaks into governance and curated ownership docs

Execution must account for both runtime and documentation residue:
- `berlin/src/account-governance.ts`
- `documentation/services/michael.md`
- `documentation/capabilities/multitenancy.md`

Why this matters:
- curated/platform ownership is still documented and partially enforced through a single admin account identity
- PRD 065 replaces that with explicit source/platform ownership rules
- if these files are not updated together, delete-account rules, curated ownership, and platform behavior will contradict each other

### 7) Acceptance of PRD 065 includes these dependency sweeps, not just the primary runtime cutovers

The execution team must not mark PRD 065 complete while any of the dependency clusters above still teach or preserve the old model.

---

## Exact non-goals

This PRD does **not** do:
- Stripe/billing implementation
- invoice/subscription lifecycle
- SCIM/SAML/enterprise provisioning
- connector/workspace-connection platform work
- support impersonation redesign
- generic entitlements override engine
- final SMS/WhatsApp vendor selection as a standalone architecture project
- implementation of Vienna / the broader communications delivery system

If any of those become necessary, they require separate PRDs.

---

## Execution strategy

This PRD is executed by **invariant**, not by service ownership diagrams or UI polish.

The order is always:
1. lock the canonical truth first (`Berlin`, the entitlement matrix, or the canonical contract for that workflow)
2. converge every touched consumer in the same slice (`Roma`, `Bob`, `Paris`, `Tokyo-worker`, `DevStudio`, docs)
3. delete the old fallback / back-compat / hidden path in the same slice
4. verify in `local` first with `bash scripts/dev-up.sh`
5. verify the same workflow in `cloud-dev` if that workflow exists in the shared runtime

Execution rules:
- do not start in `Roma`, `Bob`, or `Paris` if the source-of-truth contract is still ambiguous
- do not land UI-only cleanup that merely hides broken account truth
- do not keep dual-read, dual-write, silent fallback, or privileged back-compat behavior after the replacement path exists
- do not close a phase while a touched workflow still depends on the old model
- if execution discovers another hidden fallback, secret fallback, back-compat shim, or privileged shortcut, add it to this PRD before continuing and remove it in the current phase or the immediately following explicit phase

This is a boundary-closure PRD. It is not complete when the UI looks cleaner. It is complete only when the old hidden behavior is gone.

## Current execution drift correction (2026-03-12 pause)

Execution paused to compare current runtime/code against PRD 65 intent.

Result:
- PRD 65 has made real progress, but the repo is **not yet in a safe "continue normally" state**.
- Several slices that look partially complete in `local` still retain old-model residue.
- `local` verification alone is currently ahead of `cloud-dev` verification, which is not allowed as a phase-close standard for workflows that live in both environments.

The most important remaining drift is:

1. Hidden trusted-dev authority still exists on normal product account routes.
   - Paris still has trusted-dev owner behavior on capsule-required product paths.
   - Bob account routes still allow local trusted-dev capsule absence on normal `/api/accounts/*` flows.
   - Bob local trusted-dev contract can still jump to Michael service-role access.

2. The legacy person contract still acts as runtime truth.
   - Bootstrap/self-profile/member summaries still depend on `display_name`.
   - `User Settings` still writes derived `displayName` plus old `preferredLanguage`/`countryCode` semantics.
   - The canonical `User Settings` field contract in this PRD is therefore not actually complete yet.

3. Invitation acceptance tokens are still exposed as normal Team surface data.
   - The system still serializes and renders a manual accept path as normal invitation metadata.
   - That violates the PRD rule that invitation credentials remain opaque acceptance artifacts, not standard account-management UI data.

4. Missing authoritative usage/storage infrastructure must not silently degrade to fake truth.
   - Product/account flows must not return synthetic `0 used` values or allow writes because required enforcement state is missing.
   - Non-authoritative warm mirrors may remain best-effort only when their absence does not change storage enforcement or account-route write authorization.

5. `cloud-dev` verification is behind implementation.
   - Multiple recent slices were verified in `local` only.
   - PRD 65 does not allow phases to be treated as complete on that basis when the workflow is also live in the shared runtime.

Execution consequence:
- **Do not continue into more surface work, more Builder polish, or more account feature changes until these drift items are explicitly closed or re-planned inside PRD 65.**
- Phase labels already in the document remain valid, but the next work must start from the remaining drift below rather than pretending those earlier phases are fully done.

---

## Execution order

The phase split is deliberate:
- Phase 1 fixes **core account truth**
- Phase 2 fixes **account/auth proof truth**
- Phase 3 fixes **commercial/storage truth**
- Phase 4 fixes **customer-facing account contracts**
- Phase 5 fixes **Builder and account-shell integration**
- Phase 6 removes **cross-service ownership drift and admin-account magic**
- Phase 7 closes **docs and operator tooling**

This is the correct order because product/account UX must not be cleaned up before the system knows the right account, proves that account correctly, and enforces the correct commercial semantics.

### Immediate next execution order before continuing later phases

Before continuing any broader Phase 4/5/6 work, execution must do this exact reset:

1. **Re-verify already-touched workflows in `cloud-dev`**
   - account bootstrap / account open
   - Builder open
   - Assets list/upload/delete
   - Team / invitations
   - User Settings save + email-change request

2. **Finish the remaining account/auth proof truth cleanup**
   - remove Paris trusted-dev owner authority from normal product account routes
   - remove Bob trusted-dev capsule absence from normal product account routes
   - remove Bob trusted-local Michael service-role access from end-user product flows
   - treat any remaining local trusted-tool behavior as explicit internal tooling only, never as normal product-route authority

3. **Finish the canonical person-contract cleanup**
   - stop requiring `display_name` as bootstrap/self-profile/member-summary truth
   - stop teaching `preferredLanguage` / `countryCode` as the real contract behind `User Settings`
   - keep compatibility storage only if it is explicitly derived and non-canonical

4. **Remove invitation credential exposure from Team**
   - stop serializing/rendering invitation accept token/path as normal customer UI metadata
   - keep invitation issuance/revoke/account-manager behavior intact

5. **Fix missing usage/storage infrastructure behavior**
   - replace silent `0 used` / silent allow behavior with either:
     - explicit local implementation, or
     - explicit failure for operator repair
   - do this before claiming storage/account enforcement truth is closed

6. **Only after the above is closed, resume the later planned work**
   - remaining canonical `User Settings` model
   - Builder/account-shell convergence
   - cross-service ownership drift cleanup
   - final docs/tooling closeout

This reset is mandatory because otherwise PRD 65 would continue layering new implementation on top of still-live hidden authority and still-live legacy person truth.

### Phase 1 — Fix core account truth in Berlin

1. Remove environment-specific admin/default-account fallback from bootstrap account selection.
2. Lock the rule that if no real account associated to the user can be opened, the system fails explicitly and never opens a fallback account.
3. Change first-account auto-provision to create a distinct account UUID (`account_id != user_id`).
4. Tighten Berlin role gates for:
   - locales
   - invitation listing
   - tier-drop dismiss
5. Keep owner transfer / delete-account semantics explicit and boring while removing hidden admin-account governance assumptions.

Done when:
- active account truth comes only from persisted active-account preference or deterministic membership truth.
- the system never opens a fallback account when it cannot resolve a real user-associated account.
- first-account provisioning preserves a clean `user != account` model.
- invitation, locale-policy, and tier-drop gates are explicit and boring.
- final account-holder flows no longer depend on hidden admin-account assumptions.

### Phase 1 slices — start here

Slice 1.1:
- `berlin/src/account-state.ts`
- remove admin/default-account fallback
- enforce explicit fail when no valid account context exists

Slice 1.2:
- `berlin/src/account-reconcile.ts`
- stop `accountId = userId` first-account provisioning
- keep first sign-in atomic enough to avoid half-created states

Slice 1.3:
- `berlin/src/account-locales.ts`
- `berlin/src/account-invitations.ts`
- `berlin/src/routes-account.ts`
- `berlin/src/account-lifecycle.ts`
- `berlin/src/account-governance.ts`
- harden role gates and remove hidden governance/admin special casing in these core account paths

### Phase 2 — Fix auth/account proof truth

1. Rename and realign the account authz capsule contract to Berlin ownership.
2. Update Berlin minting plus Roma/Bob forwarding and Bob/Paris verification together.
3. Remove Paris product-path direct-membership fallback wherever capsule auth is the intended model.
4. Delete account-auth secret fallback chains; require one dedicated capsule secret across Berlin/Paris/Bob.
5. Remove synthetic owner/admin authority paths from Bob/Paris/Tokyo standard product routes.
6. Remove end-user service-role shortcuts from local product flows.

Done when:
- Berlin is the explicit owner of the account authz capsule contract in runtime, code, docs, and naming.
- `Roma`, `Bob`, and `Paris` all verify the same capsule contract with one dedicated secret and no secret fallback chain.
- Paris product routes no longer fall back to direct membership lookup where capsule auth is the intended contract.
- no standard product route fabricates owner/admin authority for convenience.
- no end-user flow jumps directly to service-role authority.

### Phase 3 — Fix commercial and storage truth

1. Redefine `budget.uploads.bytes` as total account storage bytes.
2. Remove `budget.uploads.count`.
3. Update `ck-policy`, `Tokyo-worker`, and Roma Assets together.
4. Update operator tooling and entitlement docs/templates together so they stop teaching the removed/incorrect model.

Done when:
- asset/storage truth is enforced as current stored bytes against total storage limit.
- `budget.uploads.count` is gone from runtime, UI, tooling, and docs.
- storage is never taught as a monthly concept.
- operator tooling no longer teaches the old upload-budget model.

### Phase 4 — Fix customer-facing account contracts

1. Rename the person-scoped surface from `Profile` / `My Profile` to `User Settings`.
2. Replace the user-settings field model with the canonical contract.
3. Remove linked-identity inventory from customer UX.
4. Remove team/account UI actions that mutate another person's canonical global profile.
5. Remove raw debug/internal copy and raw `coreui.errors.*` exposure from customer UI.
6. Add shared Roma form primitives instead of per-domain CSS hacks.
7. Freeze/remove customer-facing plan-change UI/path.

Done when:
- `User Settings` expresses person-scoped truth only.
- team surfaces manage memberships/privileges, not canonical person profile truth.
- linked identities remain internal and are not taught as customer product surface.
- raw ids, backend/debug copy, and raw machine reason keys are absent from customer UI.
- Roma surfaces no longer teach old `displayName` / `preferredLanguage` / `countryCode` semantics.

### Phase 5 — Fix Builder and account-shell integration

1. Make Builder open/save/localization behave like a boring one-account flow in current cloud-dev.
2. Remove mixed capsule/config/auth drift across Roma/Bob/Paris Builder paths.
3. Fix owner transfer and delete-account customer shell flows as part of the same account-shell convergence.
4. Keep Roma as thin same-origin account host only; no second account engine.

Done when:
- clicking `Edit` in Roma opens Builder cleanly for the current account in `local` and `cloud-dev`.
- Builder failure renders one human-readable product message, not raw machine keys.
- owner transfer and delete-account flows align with the corrected account truth and no longer carry old Settings/account assumptions.
- Roma acts as a thin shell over Berlin-owned account truth.

### Phase 6 — Remove Berlin content-plane ownership and admin-account special-casing

1. Split Berlin tier mutation from content-plane enforcement.
2. Add/extend explicit Paris internal tier aftermath.
3. Delete unpublish/Tokyo mirror enforcement logic from Berlin tier lifecycle.
4. Remove admin-account special-casing from platform/curated product paths and replace it with explicit ownership/source rules.
5. Remove Minibob handoff/admin-account continuation residue.
6. Remove legacy compatibility fields from canonical bootstrap/self-profile truth and stop silently defaulting invalid persisted state.

Done when:
- Berlin commits account/commercial truth only and no longer owns publish/unpublish or Tokyo mirror side effects.
- Paris owns explicit content-plane aftermath where that aftermath still exists.
- platform/curated behavior is expressed through explicit ownership/source rules, not admin-account identity magic.
- login/handoff continuation flows do not preserve hidden admin-account logic.
- canonical person/account/account-summary truth no longer depends on legacy compatibility fields.
- invalid persisted account/profile/policy state fails visibly for operators instead of silently defaulting.

### Phase 7 — Documentation and operator-tooling closeout

1. Update canonical account/docs to PRD 065 truth.
2. Update service docs, architecture docs, capability docs, and widget entitlement docs/templates that still teach PRD 064 or the wrong storage model.
3. Update operator tooling that still teaches the wrong entitlement semantics.
4. Perform a final dependency sweep before moving the PRD to `03-Executed/`.

Done when:
- docs named by this PRD teach the final runtime shape.
- admin/operator tooling no longer teaches removed entitlements or old account semantics.
- the dependency sweep items in this PRD are closed, not merely noted.
- PRD 065 can move to `03-Executed/` without leaving live old-model residue.

---

## Execution checklist (operator reference)

Use this checklist while executing PRD 065.
Do not close slices or phases by intuition.

### Global execution checklist

- [ ] Declare the active phase and the exact workflow being changed before editing code.
- [ ] Start from the canonical truth owner first: `Berlin`, the entitlement matrix, or the canonical route/contract for that workflow.
- [ ] Converge all touched consumers in the same slice across `Roma`, `Bob`, `Paris`, `Tokyo-worker`, `DevStudio`, and docs.
- [ ] Delete the old path, fallback, or back-compat behavior in the same slice; do not leave both models alive.
- [ ] Verify in `local` first using `bash scripts/dev-up.sh`.
- [ ] Verify the same workflow in `cloud-dev` when that workflow exists in the shared runtime.
- [ ] Update this PRD immediately if execution uncovers another hidden fallback, secret fallback, privileged shortcut, or compatibility path.
- [ ] Do not begin the next phase while the current phase still leaves live old-model residue for a touched workflow.
- [ ] If a pause review finds that a seemingly completed slice still has old-model residue, reopen that slice in this PRD before continuing.

### Execution-slice checklist

Every execution slice for this PRD must explicitly record:
- [ ] active phase
- [ ] source-of-truth contract changed
- [ ] dependent files/routes/surfaces converged
- [ ] old files/routes/fallbacks deleted
- [ ] `local` verification performed
- [ ] `cloud-dev` verification performed or intentionally deferred with a reason

---

## No-go sequencing

The following sequencing mistakes are not allowed:

- Do not start with `Roma` UI cleanup if the underlying `Berlin` or entitlement truth is still wrong.
- Do not add a replacement path and leave the old fallback alive "temporarily."
- Do not remove an old auth/account path before the replacement is verified in `local`.
- Do not hide raw machine errors with nicer copy while the broken account/auth contract remains uncorrected.
- Do not start phone/WhatsApp UI flows before the Berlin verification-state contract is defined.
- Do not cut Berlin content-plane side effects until the explicit Paris aftermath path is ready.
- Do not close a phase on `local` success only when the workflow is also live in `cloud-dev`.
- Do not continue into later planned phases while a pause review has identified remaining hidden authority, legacy canonical truth, invitation credential exposure, or silent missing-infrastructure behavior in earlier phases.

---

## Verification matrix

Every phase close must verify the relevant scenarios below.

### Account bootstrap and account open

- A user session resolves one explicit real account associated to that user.
- If no valid account can be opened, the system fails explicitly and never opens a fallback account.
- Active account comes only from persisted active-account truth or deterministic membership truth.

### Builder open / save / localization

- Clicking `Edit` in `Roma` opens Builder for the current account cleanly.
- Instance open, localization rehydrate, and save share the same account auth contract.
- Failure renders one human-readable product message, never raw machine keys.

### User Settings

- `User Settings` loads person-scoped truth only.
- Updating first/last name, primary language, country, and timezone follows the canonical contract.
- Email change uses the Berlin-owned auth flow.
- Phone/WhatsApp become active only after verification.

### Team, invitations, and locale policy

- Owners/admins can manage membership and privileges.
- Non-manager roles cannot list invitations or mutate account policy.
- Team surfaces do not mutate another user's canonical global person profile.

### Assets and storage

- Asset upload enforces total storage truth, not a monthly pseudo-storage meter.
- Deleting an asset frees storage because current stored bytes decrease.
- Roma Assets teaches `storage used / storage limit / per-file limit` in human terms.

### Hidden fallback and local/dev bypass removal

- No product route fabricates owner/admin authority for convenience.
- No product route skips normal account checks because of trusted dev tokens.
- No product route treats missing capsule/account proof as acceptable just because the caller is local trusted dev.
- Missing infrastructure fails explicitly; it does not silently return zero usage or allow writes.

### Environment expectations

- `local`: strict enough to prove the real contract works without privileged shortcuts.
- `cloud-dev`: same workflow works on the shared runtime without hidden admin/account/auth exceptions.

---

## Discovery rule

This PRD assumes more hidden residue may still exist.

If execution finds another:
- privileged account fallback
- secret fallback
- direct-membership fallback where capsule auth is intended
- service-role shortcut in a product flow
- silent no-op enforcement path
- legacy compatibility field acting as canonical truth
- admin-account special case standing in for real ownership rules

then that residue is added to this PRD before the active slice closes, and the phase is not considered complete until it has an explicit removal plan inside PRD 065.

---

## Anti-patterns explicitly forbidden during execution

- UI relabeling without backend truth change
- backend truth change without removing old truth readers
- dual truth
- dual naming contracts
- trusted local/product shortcuts
- “temporary” compatibility shims without an explicit removal gate
- preserving bad behavior because it might be useful later
- adding helper layers to hide unresolved architectural disagreement

---

## Acceptance gates

This PRD is complete only when all are true:

1. A new user’s first auto-created account has `account_id != user_id`.
2. Berlin bootstrap never prefers the admin account because of environment logic.
3. Active account comes from `active_account_id` or deterministic membership fallback only.
4. Roma no longer exposes customer-facing plan-change actions.
5. Customer-facing tier mutation is frozen/removed from the standard product shell and its same-origin proxy route.
6. Berlin tier lifecycle no longer unpublishes instances or enqueues Tokyo mirror behavior directly.
7. Paris owns explicit tier/content aftermath.
8. Editors cannot mutate account locale policy/settings.
9. Viewers/editors cannot list invitations.
10. The standard customer-facing member-profile patch path is removed from the account-management contract.
11. Customer team surfaces cannot mutate another user’s canonical global profile.
12. The account authz capsule contract names/issuer semantics match Berlin runtime ownership.
13. Paris product account routes no longer silently fall back to direct membership lookup where capsule auth is the intended model.
14. The person-scoped customer surface is named `User Settings`, not `My Profile`.
15. User Settings no longer renders raw user ids, membership diagnostics, linked-identities inventory, or service-owner copy.
16. User Settings no longer exposes `Display name`, `Preferred language`, or `Country code` as customer-facing inputs.
17. `First name` and `Last name` are the customer-facing source of truth, and `First name` is the default salutation source.
18. `Primary Language` is the customer-facing field used for communication/UI defaults.
19. `Country` is customer-facing while canonical persistence may still use a country code internally.
20. `Timezone` is derived from `Country` and is only directly selectable when the chosen country has multiple supported timezones.
21. Email change is available through a Berlin-owned auth flow; `user_profiles.primary_email` is synced from confirmed auth email rather than edited directly as profile truth.
22. Phone and WhatsApp can be added only through verification flow and are not considered active until verified.
23. Berlin owns verification state/challenge lifecycle, but does not become the general email/SMS/WhatsApp delivery system.
24. Vienna is the intended communications boundary for delivery, but PRD 65 remains executable while Vienna is backburnered.
25. Raw `coreui.errors.*` values are not rendered directly in Roma product UI.
26. Shared form primitives for person/team/settings forms exist in `roma/app/roma.css`; the layout is not fixed with per-domain hacks.
27. The canonical entitlement matrix remains the hard source of truth for caps/budgets/flags during PRD 65 execution.
28. `budget.uploads.bytes` is defined and documented as total account storage bytes, not a monthly upload meter.
29. `budget.uploads.count` no longer exists in the entitlement matrix, registry, product UI, or upload enforcement path.
30. Tokyo-worker no longer enforces asset storage through month-keyed upload counters.
31. Asset upload is denied when `current stored bytes + incoming file size` would exceed `budget.uploads.bytes.max`.
32. Asset delete increases available storage because current stored bytes decrease.
33. Roma `Assets` shows storage used / storage limit / per-file limit, and does not present storage as a monthly concept.
34. Berlin bootstrap contains no privileged/admin hidden fallback in default account selection.
35. In the current one-account cloud-dev runtime, clicking `Edit` in Roma opens Builder without mixed `403` / `500` capsule/config drift across instance/localization paths.
36. Builder open failure, when it does occur, renders one human-readable product message rather than raw `coreui.errors.*` machine keys.
37. Roma, Bob, and Paris use one aligned account auth capsule contract for Builder open/save/localization flows.
38. Account auth capsule signing/verification uses one dedicated secret and does not fall back to `AI_GRANT_HMAC_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`.
39. No standard product route in Paris/Bob/Tokyo fabricates synthetic owner/admin account authority for local/dev access.
40. Bob local product flows do not jump directly to Supabase service-role access for Michael from an end-user token.
41. Tokyo account asset routes do not skip membership/account authorization because of trusted user-token shortcuts.
42. Missing authoritative usage/storage infrastructure does not silently return zero usage or allow writes in product/account flows. Best-effort warm mirrors are allowed only when they cannot change enforcement or write authorization.
43. Berlin bootstrap and member/account summaries no longer require `display_name` as canonical person truth.
44. Legacy fields such as `display_name`, `preferred_language`, and `country_code` are not read as canonical runtime truth anywhere in product/account flows. If they still exist in persistence, they are inert storage residue only.
45. Curated/platform product behavior is enforced by explicit source/platform ownership rules, not `accountId === adminAccountId` branching.
46. Invalid persisted account locale/policy/profile state surfaces an operator-visible defect instead of silently defaulting in canonical product/account flows.
47. Team/customer invitation surfaces no longer expose raw accept tokens or shareable acceptance paths as normal invitation metadata.
48. Capsule-required product routes in Paris/Bob do not accept capsule absence merely because the caller is trusted local dev.
49. Workflows touched in this PRD are verified in both `local` and `cloud-dev` before their parent phase is considered complete.
50. Canonical docs and operator tooling in `documentation/architecture/AccountManagement.md`, `documentation/architecture/AssetManagement.md`, `documentation/architecture/Overview.md`, `documentation/services/berlin.md`, `documentation/services/roma.md`, `documentation/services/paris.md`, `documentation/services/bob.md`, `documentation/services/devstudio.md`, `documentation/services/michael.md`, `documentation/services/tokyo-worker.md`, `documentation/capabilities/multitenancy.md`, relevant widget entitlement docs/templates, and `admin/src/html/tools/entitlements.html` are updated before this PRD moves to `03-Executed/`.
51. No product read model (`/v1/session/bootstrap`, `/v1/me`, account member summaries, Team surfaces, User Settings) selects or depends on `display_name` as canonical person truth.
52. No product write model writes `display_name` as part of normal User Settings mutation.
53. No PRD 65 slice may introduce a compatibility bridge, fallback branch, or helper abstraction unless the PRD explicitly names it and explains its removal path.
54. Because there are no active external users, internal breaking changes that reduce entropy are allowed and preferred over preserving bad contracts.
55. Any remaining legacy persistence field must have zero effect on product behavior; if removing it would change behavior, PRD 65 is not yet closed.

---

## Failure modes this PRD explicitly avoids

We are avoiding these bad outcomes:

1. one customer owner can upgrade/downgrade themselves into any entitlement state
2. account service starts owning publish/unpublish behavior
3. product shell and account service disagree on active account truth
4. team admins edit global person records through account surfaces
5. invitation links leak broadly across normal member UI
6. product account auth keeps drifting between capsule truth and direct membership fallback
7. customer UI teaches backend structure instead of user meaning
8. user contact verification drifts into ad-hoc per-channel hacks
9. long-lived accounts can accumulate effectively unbounded asset storage because enforcement resets monthly while assets persist forever
10. AI-generated implementation keeps inventing or reinterpreting entitlement semantics in product/account surfaces, causing the matrix, the UI, and runtime behavior to drift apart
11. privileged/admin hidden fallback remains embedded in core account selection and later turns into a real security/data-isolation defect when multi-account returns
12. the current one-account Builder flow remains brittle enough to fail on capsule/config drift and teaches users backend machine errors instead of product behavior
13. account auth proof remains coupled to unrelated AI or service-role secrets, making security ownership unclear
14. local/dev product routes continue to fabricate owner/admin authority and teach a second hidden auth model
15. local missing-usage infrastructure keeps silently disabling enforcement and gives false confidence
16. legacy compatibility fields continue to define canonical person/account truth and block real contract cleanup
17. platform/curated behavior remains hidden admin-account branching instead of explicit ownership rules
18. invalid persisted account state keeps silently defaulting instead of surfacing a repairable defect
19. invitation acceptance credentials keep leaking into normal customer/team UI
20. account architecture remains “almost right” but never becomes boring enough to trust at scale

---

## Final expected state

After PRD 065:
- Berlin is plainly the identity + account boundary.
- The account model is clean SaaS architecture, not Clickeen-specific improvisation.
- Commercial/account truth is no longer self-editable product state.
- Content-plane enforcement is owned by content-plane services.
- Roma/Bob are real consumers of account truth, not secondary account engines.
- The remaining account system is simpler than today, not more elaborate.
