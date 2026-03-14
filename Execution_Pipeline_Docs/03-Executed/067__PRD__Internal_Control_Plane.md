# PRD 067 — Separate Internal Control Plane

Status: EXECUTED
Date: 2026-03-13
Owner: Product Dev Team
Priority: P0

Snapshot notice:
- This PRD is a historical snapshot of the codebase and architecture at the time it was executed.
- It is superseded by PRD 068 and any later PRDs.
- Do not use this PRD as forward-looking architecture guidance except as historical context.

Execution closeout:
- Closed as historical snapshot on 2026-03-13.
- Any remaining corrections, hardening, or architecture work move forward through PRD 068 and later only.

## Execution status

Current implementation status:

1. Landed locally:
   - company-plane persistence foundation
   - append-only internal control audit log
   - account-level commercial override state
   - `Paris` internal route for sponsored account onboarding
   - same-origin `DevStudio` local route for sponsored account onboarding
   - targeted `DevStudio` sponsored onboarding tool
   - `Paris` internal route for customer email recovery
   - `Paris` internal route for non-owner account member removal
   - `Paris` internal route for user session revoke
   - same-origin `DevStudio` local routes for those recovery/removal actions
   - targeted `DevStudio` customer recovery tool
   - `Paris` internal route for reversible account publishing containment
   - same-origin `DevStudio` local route for pause/resume publishing containment
   - Roma publish hard-stop while account publishing containment is active
   - Paris widgets action-matrix suppression while account publishing containment is active
   - `Paris` internal route for support target-open into Bob
   - `Paris` internal route for support save back from Bob
   - same-origin `DevStudio` local route for support target-open into Bob
   - same-origin `DevStudio` local route for support save back from Bob
   - DevStudio local customer-recovery tool can open a targeted customer widget in Bob
   - Bob host delegation now supports `devstudio-support` as an explicit host surface
2. Explicitly pending:
   - outbound posting/integration containment beyond the current widget publish path

This PRD remains `EXECUTING` until the remaining targeted tools are built and verified.

## One-line objective

Define and build the separate internal control plane for company-plane operations such as support intervention, trust and safety actions, commercial overrides, and internal account moderation without collapsing those powers into Berlin product roles.

## Why this exists

PRD 064 made Berlin the canonical product identity/account boundary.
PRD 065 closed product-boundary drift.
PRD 066 removed the fake DevStudio account-console shape and locked the decision that Berlin must remain product-only.

That leaves one real unresolved problem:

Clickeen still needs a safe way for the internal human running the company to do company-plane work such as:
- recover a locked-out customer account
- change a customer email after internal verification
- remove a member who is abusing a customer account
- pause publishing/posting when illegal or harmful behavior is happening
- create sponsored test accounts and give them complimentary access
- locate a customer widget and open it in DevStudio/Bob when support intervention is required

These are real needs.
They must happen in DevStudio.
But they must not be implemented by:
- turning the internal human into an `owner` or `admin` member of every customer account
- adding `is_staff`, `is_operator`, or global-admin flags to Berlin product roles
- turning DevStudio into a generic browse-all-accounts shell
- making Berlin the holder of broad company-plane superpowers

## Current company reality

Clickeen currently has one internal human.
That means the workflow must stay simple:
- no fake support-team process design
- no maker/checker theater
- no generalized admin-console SaaS abstraction

The simplicity must be in the workflow, not in the authority collapse.
The internal human must be able to do the work directly in DevStudio.
The system must still keep product-plane account memberships separate from company-plane control authority.

## Decision

The chosen model is:

1. `Roma` remains the customer/member shell.
2. `DevStudio` remains the internal toolbench.
3. `Berlin` remains the canonical product/account boundary only.
4. Company-plane authority is implemented in a separate internal control plane.
5. The initial internal control plane backend lives in `Paris` as internal-only control routes.

Why Paris for the initial backend:
- Paris is already the internal orchestration boundary.
- Paris already has explicit internal-route patterns.
- Paris is not the product account boundary, so this does not reopen Berlin as god-mode.
- This avoids inventing a brand-new service before the need is proven.

Non-negotiable:
- this does **not** make Paris a customer account-management boundary again
- these routes are company-plane internal routes only
- customer/member product flows continue to use Berlin/Roma/Bob as already defined by PRD 064/065/066

## Plain-language model

In human words:
- `Roma` is where customers use Clickeen.
- `DevStudio` is where Clickeen runs Clickeen.
- `Berlin` answers boring product questions such as who the user is, which account is active, and what their account role is.
- the separate internal control plane answers company questions such as how the owner changes a locked-out customer's email, grants complimentary access, pauses abusive activity, or opens a customer widget for support intervention.

## Hard constraints

1. Berlin must not treat the internal human as a universal customer-plane admin.
2. No product user/account row may gain global company-plane power through flags such as `is_staff`, `is_operator`, `sudo_mode_active`, or equivalent.
3. Internal humans must not be added as `owner/admin` members of customer accounts just to gain access.
4. DevStudio must not become a generic browse-all-accounts shell.
5. DevStudio must expose targeted internal tools, not a second customer IA.
6. Company-plane actions must be explicit and narrow.
7. Every company-plane action must be auditable.
8. Product-plane account roles (`owner/admin/editor/viewer`) remain boring and unchanged.
9. Product-auth realism remains in Roma, not DevStudio.
10. Local internal-tool authority must stay confined to explicit DevStudio routes only.

## What we are solving

### Use case 1 — Locked-out customer + abusive member

A customer contacts Clickeen and says:
- their email has been deactivated
- they can no longer log in
- one of their team members is posting illegal content through Clickeen

Clickeen must be able to do all of this in DevStudio:
1. locate the customer account and the affected people
2. pause the abusive posting/publishing path
3. change the real customer's email after internal verification
4. remove the abusive member
5. revoke that user's active sessions if needed
6. pause account publishing immediately while the issue is being contained

### Use case 2 — Sponsored test accounts

The owner wants to create 5 accounts for testers, give each one complimentary `tier3`, and send them owner invitations so they can log in without building the account themselves.

Clickeen must be able to do all of this in DevStudio:
1. create the account
2. apply complimentary commercial access
3. issue the owner invitation
4. send/copy the onboarding path for the invited human

### Use case 3 — Support intervention on a customer widget

A customer cannot fix their widget and asks Clickeen to do it.

Clickeen must be able to do all of this in DevStudio:
1. locate the target account/widget
2. open the target in Bob through DevStudio
3. perform the edit
4. save/publish through an explicit company-plane support path

Current first slice:
- local only
- targeted customer-owned widget only
- base-config save path only

### Use case 4 — Future internal company operations

Examples:
- pause an account
- restore an account
- grant free months
- apply a commercial override
- disable publishing for trust/safety reasons

These belong to the same company-plane authority family and must grow from the same internal control plane, not as ad hoc product-role hacks.

## Out of scope for this PRD

1. A general-purpose employee directory, RBAC graph, or staff org chart.
2. Multi-person approval workflow design.
3. Any future remote/internal access design beyond what is minimally needed after the local-first control plane is proven.
4. A generic internal admin console with tables for every entity in the business.
5. Reopening Berlin as the place where global company-plane human power lives.

## Intended architecture

### Surfaces

1. `DevStudio`
   - internal toolbench UI
   - hosts the internal tools the owner uses
   - calls same-origin internal tool routes only

2. `DevStudio same-origin control routes`
   - `GET/POST /api/devstudio/control/*`
   - stable UI-facing route family for internal tools
   - local implementation via Vite middleware only

3. `Paris internal control routes`
   - `GET/POST /internal/control/*`
   - internal-only company-plane backend
   - orchestrates company-plane actions
   - may call canonical backend owners and storage layers as needed

4. `Berlin`
   - remains the canonical product identity/account boundary
   - continues to own product account/profile/member truth
   - does **not** become the holder of broad company-plane human authority

5. `Bob`
   - remains the editor kernel
   - support intervention opens Bob from DevStudio; Bob does not gain its own company-plane authority model

### Authority split

Product plane:
- person identity
- active account
- account memberships
- normal account roles

Company plane:
- support intervention
- moderation / trust & safety actions
- commercial overrides
- internal onboarding / sponsored-account creation

The same human may use both planes, but the authority model must remain separate.

## Initial implementation shape

### Backend placement

The initial control-plane backend lives in `Paris` under `internal/control/*`.

This is the simplest boring choice because:
- it is separate from Berlin
- it already fits the internal orchestration role
- it avoids inventing a new service too early

Rule:
- Paris company-plane routes are internal-only
- they must never be mounted as customer/member product routes
- they must never be treated as a new product account API

### DevStudio UI shape

DevStudio may expose targeted internal tools such as:
- sponsored account creation
- recovery + member removal
- support widget intervention
- moderation pause/unpause

DevStudio must not expose:
- generic account browsing
- account switch like a customer shell
- a generic account CRUD explorer

### Local contract

Local DevStudio remains the owner toolbench.

Local company-plane routes must:
- stay under `/api/devstudio/control/*`
- use explicit local internal-tool authority
- never be interpreted as customer product login
- never leak authority to product routes

## Minimal action set for Phase 1

Phase 1 should build only the smallest real set of company-plane actions needed now.

### A. Sponsored account onboarding

DevStudio tool action:
- create sponsored account

Effect:
1. create the account
2. apply complimentary `tier3`
3. issue owner invitation to the target email

Important:
- the invited human still claims their own access
- Clickeen does not create fake customer credentials on their behalf

### B. Recovery + member removal

DevStudio tool actions:
- change customer email
- remove account member
- revoke user sessions

Important:
- email change remains a company-plane recovery action, not a fake customer self-service mutation from DevStudio
- member removal is explicit and targeted, not a browse-and-edit shell pattern

### C. Publishing/posting containment

DevStudio tool action:
- pause or resume account publishing for trust/safety reasons

Important:
- start with reversible containment
- do not start with irreversible destructive delete flows
- the first slice targets the current account-owned widget publish path
- outbound posting/integration containment can follow later under the same control plane

### D. Support intervention target-open

DevStudio tool action:
- resolve target account/widget and open it in Bob for support intervention

Important:
- targeted lookup is allowed
- generic browse-all-accounts UI is not

## Minimal data shape

Use the simplest data shape needed now.

### 1. Audit log (required from day one)

Add one append-only control-plane event log.

Purpose:
- who did what
- to which target
- why
- when
- with what outcome

Minimum fields:
- `id`
- `kind`
- `actor`
- `targetType`
- `targetId`
- `accountId` nullable
- `reason`
- `payload` json
- `result` json
- `createdAt`

This is required. Company-plane actions without audit are not acceptable.

### 2. Commercial override state

Use the simplest account-level commercial shape needed for sponsored access.

Minimum shape:
- effective account `tier`
- commercial mode: standard vs complimentary
- reason
- optional expiry

This is account state, not a human authority flag.

### 3. Containment state

Use the simplest reversible restriction fields needed to pause abusive activity.

Start with explicit reversible account-level restriction state.
Do not start with permanent destructive delete semantics.

## Action ownership rules

1. `DevStudio` owns the human-facing internal tool.
2. `Paris internal control routes` own company-plane orchestration.
3. `Berlin` remains the canonical owner of product account/profile/member truth.
4. Company-plane authority must not be implemented as Berlin product roles.
5. If a company-plane action mutates canonical product data, the mutation must still preserve the existing Berlin account/profile/member invariants.

## Phases

### Phase 1 — Create the company-plane boundary

1. Add same-origin DevStudio control route family: `/api/devstudio/control/*`
2. Add matching Paris internal company-plane route family: `/internal/control/*`
3. Add audit-log persistence
4. Implement the minimal action set in this order:
   - sponsored account onboarding
   - recovery + member removal
   - revoke sessions
   - reversible account publishing containment
5. Add targeted account/widget lookup only as needed for those tools

Current Phase 1 truth:

1. Sponsored account onboarding is the first delivered slice.
2. Customer email recovery, non-owner member removal, and user session revoke are also delivered locally.
3. Reversible account publishing containment is delivered locally and enforced on the current Roma publish path.
4. Support target-open into Bob is delivered locally for targeted customer-owned widgets.
5. Support save from Bob is delivered locally for base-config updates only.
6. Outbound posting/integration containment is still open.

### Phase 2 — Support intervention open/edit path

1. Keep support intervention explicit and auditable
2. Expand beyond the initial local base-config path only when needed
3. Keep the shape targeted to a customer/widget, not a generic account shell
4. Do not introduce a generic browse-all-accounts shell while expanding support intervention

### Phase 3 — Remote/internal access design

1. Decide whether any non-local internal control runtime is needed at all.
2. If needed later, keep that access plane separate from Berlin product memberships and Roma customer login semantics.
3. Do not reintroduce a fake Cloudflare DevStudio runtime just to carry company-plane actions.

## Hard failures

PRD 067 fails if execution does any of the following:

1. Adds global company-plane flags to Berlin product users/roles.
2. Adds the internal human as `owner/admin` to customer accounts just to gain access.
3. Builds a generic account browser/account shell in DevStudio.
4. Reopens Berlin as the human company-plane superadmin boundary.
5. Implements company-plane actions without an audit log.
6. Reintroduces product login/account-switch semantics into DevStudio local by default.
7. Builds the future system as role-theory/pre-work instead of the minimal real tools needed now.

## Acceptance criteria

1. DevStudio exposes targeted company-plane tools, not a generic account browser.
2. The owner can create sponsored tester accounts from DevStudio.
3. The owner can apply complimentary `tier3` access from DevStudio.
4. The owner can issue owner invitations from DevStudio for those sponsored accounts.
5. The owner can change a locked-out user's email from DevStudio.
6. The owner can remove an abusive member from DevStudio.
7. The owner can revoke a user's sessions from DevStudio.
8. The owner can apply a reversible account publishing pause from DevStudio.
9. The owner can resume account publishing from DevStudio.
10. Roma publish routes fail explicitly while account publishing containment is active.
11. The owner can target a customer widget from DevStudio and open it in Bob for support intervention.
12. Every action above writes an audit event.
13. No new Berlin product role or global human flag is introduced.
14. No DevStudio runtime surface teaches internal humans to browse accounts like privileged customers.

## Verification

### Local

1. Start DevStudio local.
2. Verify `/api/devstudio/control/*` is the only company-plane UI route family.
3. Create a sponsored account and confirm:
   - account exists
   - complimentary tier state exists
   - owner invitation exists
4. Run recovery flow and confirm:
   - email changed
   - member removed
   - sessions revoked
5. Run containment flow and confirm the account/widget path is paused.
6. Open a customer widget from DevStudio into Bob using the support-intervention path.
7. Save a base-config change through the support path and confirm it persists.
8. Confirm audit events exist for every action.

### Cloud-dev

1. Verify company-plane routes are not public product routes.
2. Verify removed bad surfaces stay gone:
   - no generic account browser
   - no DevStudio account shell
   - no Berlin-owned global company-plane role behavior

## References

- [PRD 064](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/064__PRD__Berlin_Account_Management_Boundary__Single_Identity_And_Account_API.md)
- [PRD 065](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/065__PRD__Berlin_Account_Management_Level_Up__Boundary_Closure_and_Commercial_Truth.md)
- [PRD 066](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/066__PRD__DevStudio_Internal_Control_Plane__Berlin_VS_Separate_Admin_Authority.md)
