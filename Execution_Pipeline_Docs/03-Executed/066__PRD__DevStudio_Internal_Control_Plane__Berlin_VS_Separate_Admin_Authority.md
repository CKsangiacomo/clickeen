# PRD 066 — DevStudio Internal Control Plane — Option B Execution Plan

Status: EXECUTED
Date: 2026-03-13
Owner: Product Dev Team
Priority: P0

Decision record:
- Option B is chosen.
- `Berlin` remains the canonical product identity/account boundary only.
- Broad internal/company authority will not be modeled as Berlin-owned superadmin power.
- `DevStudio` remains the internal toolbench, not a second customer shell and not a generic admin console.

Environment contract:
- Read truth: `local`
- Write order: `local` first
- Canonical startup: `bash scripts/dev-up.sh`

Execution record:
- `local` runtime/docs cleaned and verified on 2026-03-13.
- fake DevStudio Cloudflare runtime removed from repo truth on 2026-03-13.
- `/api/devstudio/accounts*` removed from runtime and documentation.
- DevStudio is now defined as local-only internal toolbench.

---

## One-line objective

Execute the Option B direction by removing the fake DevStudio account-console shape, restoring the correct DevStudio local contract, rewriting the docs to the right model, and opening the clean path toward a separate internal control plane.

---

## Why this PRD exists

PRD 064 and PRD 065 converged the product boundary toward:
- `Berlin` = canonical identity + account truth
- `Roma` = customer/member shell
- `Bob` = editor kernel

During that work, AI execution drifted into a bad pattern:
- treating `DevStudio` like a second product shell
- inventing a generic `Accounts` domain in Roma
- inventing a generic `Account Operator` console in DevStudio
- pushing toward the idea that `Berlin` should recognize some human as a global internal admin who can act on every account

That direction is wrong.

It is wrong architecturally because it collapses the customer/product plane and the internal/company plane.

It is wrong operationally because it turns internal platform work into a fake customer-account browsing model.

It is wrong from a security perspective because it pushes broad destructive authority toward the same boundary that already owns product identity and account truth.

This PRD exists to stop that drift and execute the chosen correction.

---

## What we are trying to solve

Clickeen needs an internal surface for real platform work.

Current company reality:
1. there is one internal human
2. DevStudio must let that human directly manage Clickeen
3. the workflow must stay simple and direct
4. we must not invent fake support-team/process complexity that does not exist
5. we must also not solve simplicity by collapsing customer authority and internal company authority into the same product model

Examples:
1. Test newly built widgets before and after GA.
2. Curate and verify platform-owned starter instances.
3. Inspect runtime and deploy behavior.
4. Run internal-only authoring and verification flows.
5. Later, support company-plane actions such as moderation, commercial overrides, and trust/safety workflows.
6. Recover a locked-out customer account.
7. Change a customer's email when the old address is dead.
8. Remove a team member from an account.
9. Pause posting/publishing when a customer account is being abused.
10. Open a customer widget and fix it directly when support intervention is required.

Those needs are real.

What we must not do is solve them by turning `DevStudio` into Roma 2 or by teaching `Berlin` that some internal human has everyday god-mode authority over every customer account.

---

## Locked architectural decision

The following points are no longer under debate in this PRD:

1. `Roma` remains the customer/member shell.
2. `DevStudio` remains the internal toolbench.
3. `Berlin` remains the product identity/account boundary only.
4. Internal/company-plane authority will be separated from product account roles.
5. We will not add a fake product role such as `operator`.
6. We will not make an internal human a normal `owner/admin` member of every account.
7. We will not teach `Berlin` that one everyday identity can broadly control all accounts.
8. `DevStudio local` optimizes for internal tool usability, not customer auth realism.
9. There is no canonical Cloudflare DevStudio runtime.
10. Customer auth/session realism continues to live in `Roma`, not in `DevStudio`.

---

## Canonical definition of DevStudio

For this PRD, `DevStudio` means:

**Clickeen's internal toolbench for platform work.**

It is where internal humans:
1. test widgets
2. curate platform-owned content
3. verify runtime and deploy behavior
4. use narrowly scoped internal tools that belong to the company plane rather than the customer plane

It is not:
1. Roma 2
2. a generic customer-account browser
3. a second account information architecture
4. a global superadmin portal
5. a place to test customer auth realism by default

In plain language:

`Roma` is where people use Clickeen as customers/members.

`DevStudio` is where Clickeen uses DevStudio to run Clickeen internally.

That means DevStudio is the management environment for Clickeen itself, but it must express that through focused internal tools rather than a fake all-powerful account shell.

---

## How extended platform work happens in DevStudio

DevStudio is not only for widget testing or Roma-adjacent flows.

It is the internal environment where Clickeen does broader platform work such as:

1. Widget and platform authoring
   - test new widgets
   - curate starter/main instances
   - verify publish and localization behavior
   - inspect asset/runtime integrity

2. Commercial operations
   - grant free months
   - apply commercial overrides
   - inspect commercial state
   - support internal commercial adjustments

3. Trust and safety
   - review incidents
   - pause or quarantine accounts
   - disable public serving where required
   - inspect abuse state

4. Support and investigation
   - inspect account/user state
   - understand what a customer is seeing
   - trace boundary/runtime failures
   - support recovery flows

5. Operational verification
   - inspect deploy/runtime status
   - validate cloud-dev and later GA behavior
   - run internal verification flows

6. Design system and internal tooling
   - Dieter previews
   - fixtures
   - internal QA utilities
   - development-only authoring helpers

The important architectural rule is:

DevStudio is the place where internal tools live, but it must not become a giant generic admin cockpit.

Extended platform work must happen through:
1. narrow tools with clear purposes
2. the correct backend owner for each tool
3. explicit boundaries between customer-plane truth and company-plane authority
4. scoped actions, not a universal “operator can do anything” model

This means:

1. DevStudio may host the internal UI for platform management.
2. `Berlin` still stays the canonical product identity/account boundary.
3. Future company-plane actions use a separate internal control plane, not Berlin-owned superadmin authority.
4. DevStudio must not solve internal management by pretending internal humans are privileged customers browsing accounts.

### Support and intervention use case

To make this concrete:

If a customer contacts Clickeen because they cannot fix their widget themselves, the human action still happens in `DevStudio`.

The expected internal flow is:
1. locate the target customer/account/widget through the appropriate internal DevStudio support tool
2. open the target widget from `DevStudio`
3. hand off editing to `Bob`
4. save/publish through the correct internal support authority model
5. record the intervention through the appropriate audit path

So the rule is:

1. `DevStudio` is the internal management environment where the human performs the action.
2. `Bob` remains the editing surface used inside that workflow.
3. What this PRD rejects is not the use case itself.
4. What this PRD rejects is implementing that use case by:
   - turning `Berlin` into a universal superadmin boundary
   - making internal humans normal `owner/admin` members of every account
   - treating DevStudio like a generic browse-all-accounts customer shell

In plain language:

**Support intervention happens in DevStudio.**

The architectural question is only how that authority is modeled safely behind DevStudio.

### Internal onboarding and complimentary-access use case

Another concrete case:

The owner wants to create 5 test accounts, give them `tier3`, and not charge them because they are testing Clickeen for us.

Those humans should not have to spend time creating the accounts themselves.

The correct internal flow still happens in `DevStudio`:
1. create the account
2. set the complimentary/commercial override for that account
3. issue the owner invitation to the target human
4. send the onboarding instructions so the invited owner can claim access

What this means:

1. DevStudio must support direct internal onboarding actions for new accounts.
2. DevStudio must support internal commercial setup such as complimentary `tier3` grants.
3. The invited human should claim the already-created account rather than being forced through customer self-serve account creation first.
4. This is a real internal management use case and must be easy for the one internal human running Clickeen.

What this does **not** mean:

1. internal humans become normal `owner/admin` members of every created account
2. internal humans create fake user credentials on behalf of customers
3. `Berlin` becomes a universal superadmin authority that can do everything everywhere by default

In plain language:

**DevStudio must let the owner create accounts for testers, grant complimentary access, and onboard them directly.**

The architectural question is still only how that authority is modeled safely behind DevStudio.

### One-human operating model

PRD 066 must be read against Clickeen's actual stage:

1. there is currently one internal human
2. that human uses `DevStudio` directly
3. DevStudio must therefore expose direct internal management actions without pretending a fake team/process exists

That means the internal human must be able to do things like:
1. open an account in DevStudio
2. inspect the relevant user, membership, and widget state
3. change a user's email
4. remove a member from an account
5. pause or contain posting/publishing
6. open the target widget in Bob from DevStudio and fix it
7. apply future internal commercial or trust actions from DevStudio

This PRD does **not** require multi-person workflows, maker-checker ceremony, or fake support-team abstractions in order to express those actions.

But it still requires the architecture to stay clean:
1. `DevStudio` is the internal management environment where the human performs the work
2. `Berlin` remains canonical product truth for product mutations such as user/account/member state
3. future company-plane authority must not be implemented as Berlin believing in a universal superadmin product identity
4. internal humans must not be modeled as normal `owner/admin` members of every customer account

In plain language:

The owner uses DevStudio to run Clickeen.

That is real and must be easy.

What is forbidden is implementing that reality through the wrong product/security model.

---

## What this PRD executes

This PRD executes four things.

### 1. Remove the fake DevStudio account-console shape

Delete the invented `Account Operator` surface and its runtime/API support.

Target runtime removal:
- `/#/tools/account-operator`
- `/api/devstudio/accounts`
- `/api/devstudio/accounts/:accountId`
- `/api/devstudio/accounts/:accountId/members`
- `/api/devstudio/accounts/:accountId/switch`

Reason:
- even when Berlin-backed, this shape still teaches the wrong model: internal humans acting on accounts like privileged customers
- it invites DevStudio to grow into a fake account shell

### 2. Restore the correct DevStudio local contract

`DevStudio local` must work as an internal toolbench on the owner machine.

It must not depend on customer product login semantics by default.

The local contract is:
1. explicit local-only DevStudio tool authority
2. active only when the runtime stage is `local`
3. accepted only on explicit `/api/devstudio/*` tool routes
4. never accepted on `Roma`, `Bob`, `Berlin`, `Paris`, or `Tokyo` product/account routes
5. never interpreted as a product user session, account membership, or account-switch authority
6. limited to the platform-owned internal tool context needed by the legitimate DevStudio tools that remain

The concrete local mechanism is:
1. `/api/devstudio/context` in `local` resolves a `local-tool` context from explicit local runtime configuration, not from Berlin session cookies.
2. That context returns only the minimal internal tool shape needed by surviving DevStudio tools:
   - `accountId`
   - `scope: 'platform'`
   - `mode: 'local-tool'`
3. The `accountId` comes from the local platform-account configuration (`CK_PLATFORM_ACCOUNT_ID`, falling back to the seeded local platform account id), not from customer bootstrap/session state.
4. `local-tool` context does **not** return or imply:
   - customer `user`
   - customer `profile`
   - product `defaults`
   - account membership browsing
   - account switching
5. Legitimate local DevStudio routes may consume that `local-tool` context only to resolve the platform-owned target account needed for internal authoring/verification.
6. When those local DevStudio routes call downstream local services, they use the existing explicit internal-tool transport headers (`PARIS_DEV_JWT`, `TOKYO_DEV_JWT`, `x-ck-internal-service: devstudio.local`) on the DevStudio tool routes only.
7. Those local internal-tool headers must never be forwarded or accepted as product identity on `Roma`, `Bob`, `Berlin`, or product/account routes in `Paris` or `Tokyo`.
8. This local contract exists only for the owner machine toolbench. There is no canonical Cloudflare DevStudio runtime.

Allowed local-only routes under this contract:
- `/api/devstudio/context`
- `/api/devstudio/widgets`
- `/api/devstudio/instances*`
- `/api/devstudio/assets*`
- source-profile-only local mutation helpers that already belong to the internal toolbench

Forbidden under this contract:
- `/api/devstudio/accounts*`
- product bootstrap/session routes
- product account/member/invitation/locales routes
- any route that would let DevStudio local impersonate a customer/member shell

Reason:
- product-auth realism belongs in `Roma`
- local DevStudio should be deterministic and usable for internal tool workflows

### 3. Rewrite DevStudio documentation to the chosen model

Docs must stop teaching:
- superadmin portal
- operator role
- account-browsing internal shell

Docs must teach:
- internal toolbench
- local vs cloud-dev split
- Berlin as product truth only
- separate internal/company control plane as future direction

### 4. Open the clean path to the separate internal control plane

This PRD does not implement the full future internal control plane.

It defines the boundary and removes the bad current shape so that the next implementation PRD can build the right thing.

---

## In scope

In scope for PRD 066:

1. Delete the fake `account-operator` UI/runtime shape.
2. Delete the matching DevStudio account-browsing API routes.
3. Delete the repo-root DevStudio account-route wrappers used by the current Pages project shape.
4. Remove dead helper code that exists only for that shape.
5. Rewrite `DevStudio` docs to the internal-toolbench model.
6. Rewrite system-level docs so they stop teaching DevStudio as a superadmin shell.
7. Restore a correct local-only DevStudio tool contract for the legitimate DevStudio tools that remain.
8. Update deploy/verification docs so cloud-dev no longer documents the removed account-console shape.
9. Define the acceptance bar and follow-up boundary for the later internal control-plane implementation.

---

## Out of scope

Out of scope for PRD 066:

1. Building the final company-plane moderation/commercial/support system.
2. Introducing internal company authority into `Berlin`.
3. Adding new customer-facing account surfaces in `Roma`.
4. Reworking `Roma` auth/session behavior.
5. Reworking `Berlin` product roles or memberships.
6. Designing the final approval/elevation model for destructive internal actions.

Those belong to the follow-up implementation PRD after this cleanup is complete.

---

## Execution phases

### Phase 1 — Remove the fake DevStudio account-console shape

Delete:
- `admin/src/html/tools/account-operator.html`
- `admin/functions/api/devstudio/accounts/index.js`
- `admin/functions/api/devstudio/accounts/[accountId].js`
- `admin/functions/api/devstudio/accounts/[accountId]/members.js`
- `admin/functions/api/devstudio/accounts/[accountId]/switch.js`
- `functions/api/devstudio/accounts/index.js`
- `functions/api/devstudio/accounts/[accountId].js`
- `functions/api/devstudio/accounts/[accountId]/members.js`
- `functions/api/devstudio/accounts/[accountId]/switch.js`

Review and reduce:
- `admin/functions/_lib/devstudio-api.js`
  - remove account-list/account-detail helpers that only existed for `account-operator`
  - keep the legitimate context helpers needed for remaining DevStudio tools

Expected result:
- DevStudio no longer exposes a generic account-browsing/operator console
- Tools nav no longer shows `Account Operator`
- `/api/devstudio/accounts*` no longer exists

### Phase 2 — Restore the correct DevStudio local contract

Keep legitimate internal-tool routes such as:
- `/api/devstudio/context`
- `/api/devstudio/widgets`
- `/api/devstudio/instances*`
- other explicit local-only DevStudio tool routes that support internal authoring/verification

Correct requirement:
- local DevStudio tool routes must not require Roma-style product login by default
- local-only authority must stay on `/api/devstudio/*`
- no local shortcut may leak onto product/account routes in `Roma`, `Bob`, `Berlin`, `Paris`, or `Tokyo`

Expected result:
- local `dev-widget-workspace` is usable as an internal toolbench
- `Roma` remains the place for real customer auth/session testing

### Phase 3 — Rewrite documentation truth

Rewrite:
- `documentation/services/devstudio.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/CloudflarePagesCloudDevChecklist.md`
- `admin/README.md`

Required changes:
1. Remove `Global Superadmin Portal` framing.
2. Remove `Account Operator` references.
3. Remove `operator` as a conceptual product/internal role.
4. Define DevStudio as the internal toolbench.
5. State clearly that future company-plane actions belong to a separate internal control plane, not to Berlin-owned superadmin authority.
6. Remove deploy/runtime checklist references that still document `/api/devstudio/accounts*` or a Cloudflare DevStudio runtime as part of the legitimate contract.

### Phase 4 — Open the follow-up implementation track

Create the follow-up implementation PRD for the separate internal control plane.

That follow-up PRD must own:
1. company-plane action classes
2. local vs cloud-dev authority model for DevStudio
3. audit/elevation/approval requirements
4. the actual implementation boundary for future support/commercial/trust workflows

PRD 066 ends only after that follow-up PRD exists and the bad current shape is gone.

---

## File targets

Primary files for PRD 066 execution:

Runtime/UI:
- `admin/src/html/tools/account-operator.html`
- `admin/functions/api/devstudio/accounts/index.js`
- `admin/functions/api/devstudio/accounts/[accountId].js`
- `admin/functions/api/devstudio/accounts/[accountId]/members.js`
- `admin/functions/api/devstudio/accounts/[accountId]/switch.js`
- `functions/api/devstudio/accounts/index.js`
- `functions/api/devstudio/accounts/[accountId].js`
- `functions/api/devstudio/accounts/[accountId]/members.js`
- `functions/api/devstudio/accounts/[accountId]/switch.js`
- `admin/functions/_lib/devstudio-api.js`
- `admin/functions/api/devstudio/context.js`
- `admin/vite.config.ts`

Documentation:
- `documentation/services/devstudio.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/CloudflarePagesCloudDevChecklist.md`
- `admin/README.md`

Follow-up PRD:
- `Execution_Pipeline_Docs/02-Executing/067__PRD__Internal_Control_Plane.md`

---

## Acceptance criteria

PRD 066 is complete when all of the following are true:

1. `Account Operator` no longer exists in DevStudio runtime.
2. `/api/devstudio/accounts*` no longer exists in DevStudio runtime.
3. The repo-root `functions/api/devstudio/accounts*` wrappers no longer exist.
4. `DevStudio local` legitimate tool routes work without depending on Roma-style product login semantics by default.
5. `DevStudio local` authority remains confined to `/api/devstudio/*` tool routes only.
6. `DevStudio local` authority is never treated as product identity, account membership, or account-switch authority.
7. No product route regains a trusted-local shortcut because of this work.
8. `documentation/services/devstudio.md` defines DevStudio as the internal toolbench.
9. `documentation/architecture/CONTEXT.md`, `documentation/architecture/Overview.md`, and `documentation/architecture/AccountManagement.md` teach the same model.
10. `documentation/architecture/CloudflarePagesCloudDevChecklist.md` no longer documents `/api/devstudio/accounts*` as a legitimate cloud-dev contract.
11. `admin/README.md` does not teach a conflicting DevStudio identity.
12. No doc or runtime surface describes DevStudio as a global superadmin portal.
13. A follow-up implementation PRD exists for the separate internal control plane.

---

## Verification

Local verification:
1. Start DevStudio local.
2. Confirm `Account Operator` is gone from the tools nav.
3. Confirm `GET /api/devstudio/accounts` returns `404`.
4. Confirm the repo-root `functions/api/devstudio/accounts*` wrappers are deleted.
5. Confirm `GET /api/devstudio/context` still works for the legitimate remaining tool flows.
6. Confirm `dev-widget-workspace` still loads and can open Bob correctly.
7. Confirm the local DevStudio tool contract is accepted only on `/api/devstudio/*`.
8. Confirm no customer/product route depends on or accepts the DevStudio local contract.

Repository verification:
1. Confirm the fake `account-operator` surface is absent.
2. Confirm `/api/devstudio/accounts*` is absent.
3. Confirm the deploy/runtime checklist no longer teaches those routes or a Cloudflare DevStudio runtime as canonical.
4. Confirm the remaining legitimate local DevStudio runtime still builds and loads.
5. Confirm docs and runtime now teach the same DevStudio model.

---

## Plain-language summary

This PRD is no longer choosing between two options.

The choice is made:
- `Berlin` stays product-only
- `DevStudio` stays the internal toolbench
- the future company-plane control system will be separate

So the job now is:
1. delete the fake DevStudio account console
2. restore the right local DevStudio contract
3. rewrite the docs to the right model
4. open the next PRD for the real internal control plane
