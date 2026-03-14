# Account Management (Canonical)

STATUS: CANONICAL CURRENT MODEL

This file is the canonical account-management model for Clickeen.

It defines the runtime boundary that Berlin, Roma, DevStudio, Bob, Michael, and Paris must converge to. PRD 064/065/066/067 are historical snapshots only. Forward-looking correction and hardening work now starts from PRD 068.

For product/system context, see [CONTEXT.md](./CONTEXT.md) and [Overview.md](./Overview.md).
Current status:
- No active account-management correction PRD is open.
- PRD 068 is the latest completed correction snapshot.

Historical snapshots:
- [PRD 064](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/064__PRD__Berlin_Account_Management_Boundary__Single_Identity_And_Account_API.md)
- [PRD 065](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/065__PRD__Berlin_Account_Management_Level_Up__Boundary_Closure_and_Commercial_Truth.md)
- [PRD 066](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/066__PRD__DevStudio_Internal_Control_Plane__Berlin_VS_Separate_Admin_Authority.md)
- [PRD 067](/Users/piero_macpro/code/VS/clickeen/Execution_Pipeline_Docs/03-Executed/067__PRD__Internal_Control_Plane.md)

---

## Hard invariants

1. Berlin is the single identity and account-truth boundary.
2. Michael stores account data; it is not the product-facing account API.
3. The canonical model is:
   - `User Profile` = the person
   - `Account` = the business/account boundary
   - `Account Membership` = the person's role inside that account
4. Every account has exactly one current `owner` at runtime.
5. A person may belong to many accounts, but only one account context is active at a time.
6. `owner / admin / editor / viewer` are boring account-role semantics; entitlements constrain them but do not replace them.
7. Invitation is the canonical grant-access path for a person who is not already attached to the account.
8. Social login is not only auth; it can begin a durable provider relationship Berlin later reuses or upgrades.
9. Roma is the account-scoped customer/member shell. DevStudio is the internal toolbench for platform curation, verification, and internal operations.
10. Bob consumes Berlin account truth; it never owns account management.

---

## Canonical model

### User Profile

`User Profile` is the canonical product person.

Base fields:
- `userId`
- `primaryEmail`
- `emailVerified`
- `givenName` nullable
- `familyName` nullable
- `primaryLanguage` nullable
- `country` nullable
- `timezone` nullable
- `contactMethods.phone` with `value`, `verified`, `pendingValue`, `challengeExpiresAt`
- `contactMethods.whatsapp` with `value`, `verified`, `pendingValue`, `challengeExpiresAt`

Legacy compatibility residue such as `displayName` may remain in persistence during PRD 65 cutover, but it is not a customer-facing source-of-truth input.

Berlin owns the profile boundary even as richer profile context is added later.

### Account

`Account` is the business/account boundary.

Account-scoped truth includes:
- membership set
- owner
- tier
- locale policy
- entitlements snapshot inputs
- account traits and connector context that belong to the account, not the person

### Account Membership

`Account Membership` is the person-in-account relationship.

Membership carries:
- `accountId`
- `userId`
- `role`
- lifecycle/joined metadata as needed

Membership is where normal account permissions come from.

### Provider relationship model

Berlin distinguishes three related concepts:
- `Linked Identity` = user-level fact that this person is linked to a provider account
- `Workspace Connection` = account-level reusable provider connection
- `Capability / Scope State` = what the relationship is currently allowed to do

These are required conceptual distinctions.
They must be implemented using the simplest data shape needed for current runtime, not a speculative connector framework.

---

## Roles and entitlements

| Role | Meaning |
|---|---|
| `viewer` | can view/comment; no create/edit/team/billing control |
| `editor` | viewer + create/edit widgets/content |
| `admin` | editor + manage normal team/account operations |
| `owner` | admin + final accountable holder of the account |

Owner-only powers:
- transfer ownership
- delete account
- final account-holder authority

Rule:
- effective capability = `membership role x Berlin-resolved entitlements`

Entitlements may constrain:
- seat caps
- plan/tier limits
- packaging features

Entitlements do not redefine role meaning.

---

## Product surfaces

### User Settings

Person-scoped surface for the currently signed-in human.

Owns:
- personal profile fields
- primary email visibility
- auth-owned email-change initiation
- person-level settings

Linked identities remain a Berlin-internal auth/account model, not a standard customer-facing User Settings surface.

Rules:
- canonical person details update through `PUT /v1/me`
- canonical `User Settings` fields are `givenName`, `familyName`, `primaryLanguage`, `country`, `timezone`, `phone`, and `whatsapp`
- Berlin persistence now uses the same canonical field names for person truth: `primary_language`, `country`, and `timezone`
- `timezone` is derived from `country` and is directly selectable only when the selected country has more than one supported timezone
- invalid persisted profile/account locale state must fail explicitly in canonical product/account flows; it is an operator defect, not something the runtime silently heals
- `display_name` may still exist as inert storage residue during cutover, but product read/write contracts must not expose or depend on it
- primary email change is not a generic profile patch; it is an auth-owned flow initiated through `POST /v1/me/email-change`
- contact verification is Berlin-owned and channel-specific:
  - `POST /v1/me/contact-methods/:channel/start`
  - `POST /v1/me/contact-methods/:channel/verify`
- `phone` and `whatsapp` become active only after Berlin verifies the code
- local uses a delivery-capture adapter for verification preview; `cloud-dev`/prod must fail unavailable until a real delivery dependency exists
- pending email change state is owned by the auth system; Berlin must not invent a second shadow email model in product persistence

### Account Settings

Account-scoped business/account surface.

Owns:
- account settings
- tier/billing-facing settings
- locale policy
- account-level controls

Rules:
- product shells may surface current plan/tier state
- customer-facing account settings do not directly mutate commercial plan/tier truth

### Team

Account-scoped membership-management surface.

High-level shape:
- Team root shows current members of the active account
- pending invitations may appear in the same domain
- authorized users may drill into a member detail page

Member detail page separates:
- membership/account data for this account
- read-only person context for that person

Rules:
- owner/admin are the mutation-capable Team roles
- editor/viewer do not mutate Team
- Team mutates membership only
- Team must not create account-local shadow profile data

### Switch Account

If a person belongs to more than one account, the product exposes an explicit account-switch capability.

Rules:
- Berlin owns active-account resolution
- Berlin persists the active-account preference on the canonical user-profile boundary; it does not live in Roma/Bob cookies or client-side overrides
- Roma exposes the normal product-shell switch UX
- Bob never owns account-switch logic

### Surface split

- `Roma` = account-scoped customer/member shell
- `DevStudio` = internal toolbench for platform curation, authoring, and verification
- `Bob` = editor kernel and consumer of account truth

DevStudio may host internal tools, but it must not invent a second account or provider model and it must not teach internal humans to act like privileged customers browsing accounts.

---

## Core flows

### Signup

On first successful sign-in:
1. create or resolve the `User Profile`
2. create the first `Account`
3. create the first `Account Membership` as `owner`
4. resolve the active account context

Forbidden half-states:
- authenticated user with no profile
- account with no owner
- authenticated user with no active account context

### Invitation

Invitation is the canonical way to grant access to a person who is not yet an attached member.

Berlin owns:
- issuance
- persistence
- expiry/revocation
- acceptance
- dedupe against existing user profiles / linked identities
- conversion into exactly one membership

### Multi-account people

One person may belong to many accounts.

Example:
- Mark is `editor` in Account A
- Mark is invited to Account B
- Berlin creates a second membership for the same person
- Mark is still one `User Profile`, not two users

### Person-level account creation

Creating a new account is a person capability, not a privilege that depends on being owner of some other account.

Example:
- Mark is `editor` in Account A
- Mark creates Account B
- Mark becomes `owner` in Account B
- Mark's rights in Account A do not change

### Operational cross-account humans

Normal product access still uses one `User Profile`, many `Account Memberships`, and one active account context at a time.

Internal company-plane authority is a separate concern. It must not be implemented by turning internal humans into normal `owner/admin` members of every customer account and it must not be collapsed into Berlin product roles.

---

## Bootstrap and API contract

Canonical bootstrap:
- `GET /v1/session/bootstrap`

Returns:
- user
- user profile
- accessible accounts summary
- active account
- active membership role
- tier
- locale policy
- entitlements snapshot
- normalized bootstrap connector traits:
  - `linkedIdentities`
  - `workspaceConnections`
  - `capabilityStates`
  - `traits.linkedProviders`
- signed account capsule

Canonical account API:
- `GET /v1/me`
- `PUT /v1/me`
- `POST /v1/me/email-change`
- `POST /v1/me/contact-methods/:channel/start`
- `POST /v1/me/contact-methods/:channel/verify`
- `GET /v1/me/identities`
- `GET /v1/accounts`
- `POST /v1/accounts`
- `GET /v1/accounts/:id`
- `DELETE /v1/accounts/:id`
- `GET /v1/accounts/:id/members`
- `GET /v1/accounts/:id/members/:memberId`
- `DELETE /v1/accounts/:id/members/:memberId`
- `GET /v1/accounts/:id/invitations`
- `POST /v1/accounts/:id/invitations`
- `DELETE /v1/accounts/:id/invitations/:invitationId`
- `POST /v1/invitations/:token/accept`
- `POST /v1/accounts/:id/members`
- `PATCH /v1/accounts/:id/members/:memberId`
- `DELETE /v1/accounts/:id/members/:memberId`
- `POST /v1/accounts/:id/owner-transfer`
- `PUT /v1/accounts/:id/locales`
- `POST /v1/accounts/:id/switch`

Rules:
- `POST /v1/accounts/:id/invitations` is the canonical unknown-person grant-access path
- `POST /v1/accounts/:id/members` is only for already-resolved user profiles
- `PATCH /v1/accounts/:id/members/:memberId` mutates membership only
- `DELETE /v1/accounts/:id/members/:memberId` removes a non-owner member from the account
- `GET /v1/me/identities` returns Berlin's normalized provider reuse summary; shells must not invent their own provider/account linkage model on top

---

## Ownership split

| Concern | Owner |
|---|---|
| Identity/session | Berlin |
| User profile | Berlin |
| Memberships/invitations/active account | Berlin |
| Linked identities/provider reuse | Berlin |
| Persistence | Michael |
| Account/member UX | Roma |
| Internal toolbench (curation/authoring/verification) | DevStudio |
| Editor account consumption | Bob |
| Account management runtime | Paris: none |
| Instance/l10n orchestration after account truth is resolved | Paris |

Hard rule:
- no product surface reads account-management truth directly from Michael
- Paris must not remain on account-management runtime paths after PRD 65 cutover

---

## Provider and connector rules

Social/provider login begins a durable provider relationship Berlin can reuse later.

Examples:
- Google login can later power Google-backed product capabilities
- Meta/Facebook login can later power Instagram/Meta-backed capabilities

Rules:
- reuse the existing Berlin-owned provider relationship first
- if broader scopes are needed, Berlin upgrades that same relationship
- widgets and product surfaces do not store provider tokens or raw OAuth payloads
- raw provider payloads do not become a product data model outside Berlin
- current runtime exposes the minimal reusable summary only:
  - `linkedIdentities` = person-level provider facts
  - `workspaceConnections` = account-scoped connection seeds Berlin can later upgrade
  - `capabilityStates` = current granted capability state per provider relationship

---

## What this doc is not

- This is not the billing architecture doc.
- This is not the widget save/publish doc.
- This is not the multitenancy packaging matrix.
- This is not the execution plan.

Those concerns compose with account management, but this file defines the canonical account-management model itself.
