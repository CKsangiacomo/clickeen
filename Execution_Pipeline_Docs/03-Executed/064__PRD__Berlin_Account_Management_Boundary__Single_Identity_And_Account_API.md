# PRD 064 — Berlin Account Management Boundary: Single Identity and Account API

Status: EXECUTED
Date: 2026-03-11  
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

Make **Berlin** the single **Identity + Account Intelligence API** so identity/session/profile/account/team/locales/tier/entitlements/connectors stop being a cross-service soup.

---

## Why this PRD exists

The current account/runtime model is fragmented and that fragmentation is now breaking the product in obvious ways:

1. Roma Settings can render a false locale state while DevStudio/Bob shows a different account locale state.
2. Roma Builder boot can fail on account/member/bootstrap paths while DevStudio still opens the same instance.
3. Account membership, locale policy, tier, and entitlements are being resolved through different route families and different runtime assumptions.
4. AI agents keep patching the leaf route that is red instead of converging the system to one account boundary.

Current soup:
- Berlin owns AuthN/session.
- Roma owns some account UI plus some account route glue.
- Michael is read directly in too many places.
- Bob carries some account assumptions.
- Paris still appears in account/localization control paths where it should not.

This is not one system. It is fragments of one.

PRD 064 fixes that by making account management a **single Berlin-owned control-plane boundary** backed by Michael persistence and consumed by Roma/Bob as clients.

This matters strategically, not just architecturally:
- Clickeen is PLG, so the product must know who the user is, what account/business they represent, and what they are trying to do.
- Clickeen is global, so country/language/market context changes onboarding, defaults, localization, support, and growth behavior.
- Clickeen will connect external systems (Google, Meta/Instagram, TikTok, X, Apple, website/analytics/commerce connectors). Those raw signals must be normalized somewhere once, not leak everywhere.

Account management is therefore not admin plumbing. It is a core intelligence plane for the user and account.

It is also core company infrastructure:
- Roma is not enough, because Roma is an account-scoped member shell
- Clickeen also needs an internal toolbench for platform curation, internal authoring, and verification
- DevStudio is that surface, but it is not a second customer shell and not a global superadmin portal

So this PRD is not only about customer account settings.
It is about establishing one canonical account truth that can safely power both:
- Roma as the customer/account shell
- DevStudio as the internal toolbench that consumes product truth without inventing a second account model

For Clickeen's PLG model, every truthful fact we know about the user and account can change product behavior:
- onboarding
- widget recommendations
- AI copilot behavior
- localization defaults
- growth prompts
- upgrade timing
- support triage
- automation

That means user/account management is not only CRUD. It is the system that tells the rest of Clickeen who the user is, what account/business they represent, what markets/languages matter, what external systems they have connected, and what the product should do next.

---

## Required review answers

### 1) Elegant engineering and scalability

Yes.

This PRD reduces the account system to:
- one identity/session boundary
- one user profile model
- one account bootstrap contract
- one account management API
- one connector normalization owner
- one entitlement resolution model
- one persistent data plane

That scales because every future account feature has an obvious home:
- identity/session/profile/account-control/connector-normalization -> Berlin
- persistence -> Michael
- account UI -> Roma
- internal toolbench for curation/authoring/verification -> DevStudio
- editor consumption -> Bob

### 2) Compliance to architecture and tenets

Yes.

This PRD enforces:
- one real owner per concern
- one source of truth
- no hidden fallback account paths
- fail-fast instead of fake fallback UI
- no Paris creep into account management
- no direct Michael reads from product surfaces for account behavior

### 3) Avoid overarchitecture and unnecessary complexity

Yes, with one execution caution.

This PRD does **not** introduce:
- a second account service
- a generic gateway
- a new policy service
- event buses
- account orchestration manifests
- “temporary” duplicate routes for safety

It moves ownership to one boundary and deletes the rest.

The one real overarchitecture risk is the provider relationship model:
- `Linked Identity`
- `Workspace Connection`
- `Capability / Scope State`

That conceptual separation is correct.
But execution must preserve it using the **simplest data shape that satisfies current needs**, not by prematurely building three speculative subsystems/tables/code paths just because the concepts are distinct.

### 3b) Avoid academic abstractions, meta-work, and gold-plating

Yes.

This PRD is concrete:
- exact ownership model
- exact bootstrap and account API shape
- exact docs to write
- exact routes to delete or thin
- exact acceptance gates

The only documentation work required is the minimum needed to stop the repo from teaching the wrong model.
The strategic "account intelligence" framing exists to keep AI teams from stripping necessary ownership, not to justify turning Berlin into a vague product brain or theory project.

### 4) Keep the plan simple and boring

Yes.

The final model is easy to explain:
- Berlin authenticates the user and resolves the active account session.
- Berlin exposes the account API.
- Michael stores the account data.
- Roma renders account management UI only.
- DevStudio is the internal toolbench on top of the same truth.
- Bob consumes the Berlin bootstrap snapshot and never owns account management.

That is the boring model this repo should have had from the start.

---

## Decision (locked)

### Berlin becomes the single Identity + Account Intelligence API

Berlin owns only:
1. identity/session
2. user profile
3. linked identities and connector ownership
4. account bootstrap
5. account settings/membership API
6. entitlements snapshot resolution for the active `user x account`
7. normalized user/account traits used by product and AI systems

Berlin must **not** own:
1. widget save
2. publish/unpublish
3. translation pipeline
4. asset pipeline
5. Tokyo artifact generation
6. builder business logic

### Clean ownership

| Domain | Owner | Notes |
|---|---|---|
| Identity/session | Berlin | Login, logout, refresh, provider callback, session proof |
| User profile | Berlin | Current person, profile reads/writes, login-linked identity ownership |
| Linked identities/connectors | Berlin | Provider linkage, connector ownership, normalization of raw external signals |
| Active account bootstrap | Berlin | Current user + active account + role + tier + locales + entitlements + capsule |
| Account management API | Berlin | Current account, switch, members, locales, tier |
| Account persistence | Michael | `user_profiles`, `accounts`, `account_members`, locale policy, account tier metadata, persisted connector/account traits where needed |
| Account UI | Roma | Customer/account-scoped member shell |
| Internal toolbench | DevStudio | Platform curation, internal authoring, and verification tooling |
| Editor consumption | Bob | Consumes bootstrap/account snapshot only |
| Widget/content plane | Tokyo | No account-control ownership |
| Account management | Paris | Out of scope and out of ownership |

### Hard rule

If a browser/product surface needs account behavior:
- it talks to **Berlin-owned account contracts**
- not to Michael directly
- not to Paris
- not to a Roma-invented account route with its own logic

### Closed boundary rule (hard rule)

Berlin account management must be a **closed, complete boundary**, not just a better bootstrap.

That means Berlin must own canonical contracts for the real workflows that would otherwise leak back into Roma/Bob/Michael glue:
- signup + first account creation
- list accessible accounts
- create new account
- invite a person into an account
- accept an invitation
- switch active account
- manage memberships / transfer owner / delete account
- account locales / tier / entitlements
- provider relationship reuse / upgrade

If any of those workflows exists in product reality but does not have a canonical Berlin contract, runtime will deterministically be tempted back into soup:
- Roma route glue
- Bob assumptions
- direct Michael reads
- special-case support/admin paths

This PRD is only successful if Berlin is complete enough that those temptations are unnecessary.

### Cutover discipline and dependency capture rule (hard rule)

This PRD is a cross-system cutover, not an isolated Berlin service change.

For every account workflow touched during execution, the team must explicitly capture the dependent surfaces and paths across:
- Berlin contracts
- Roma routes and UI
- DevStudio routes and internal tool flows
- Bob bootstrap/gating consumers
- Michael reads/writes
- Paris residue
- local product profile
- local source profile
- cloud-dev
- documentation that teaches the workflow

Cutover rule:
- move the workflow to Berlin-owned truth
- converge every dependent consumer on that Berlin contract
- delete or thin the old path in the same phase
- do **not** keep a legacy route, dual-read path, dual-write path, or fallback/back-compat shim "for safety"
- do **not** leave the old fragmented model reachable after the new path is live

Execution is not complete when the new Berlin path exists.
Execution is complete only when the dependent system paths are also converged or removed.

### Owner invariant (hard rule)

Every account must always have an owner.

Why:
- there must always be one accountable human who can administer the account
- the account ultimately belongs to that owner
- billing/tier/member recovery cannot depend on a best-effort role set
- an account with zero owners is an invalid state

Rules:
- every account has exactly one current owner at all times
- ownership transfer is allowed
- ownerless intermediate state is not allowed
- account creation must create the first owner membership immediately
- only the current owner may transfer ownership or delete the account
- admin is not a second owner; admin may help operate the account, but the account does not belong to admin

### User profile model (hard rule)

Account management starts with a first-class `User Profile`.

The model is:
- `User Profile` = the person
- `Account` = the business/account boundary
- `Account Membership` = person-in-account with a role

Base persisted user profile fields:
- `userId`
- `primaryEmail`
- `emailVerified`
- `displayName`
- `givenName` nullable
- `familyName` nullable
- `preferredLanguage` nullable
- `countryCode` nullable
- `timezone` nullable

Explicitly out:
- avatar/profile picture

Hard rule:
- Berlin owns the **profile boundary**, not just the base fields above
- the system may learn richer profile/account context over time
- that richer context must still have one home: Berlin-normalized user/account truth
- do not scatter "extra useful user facts" across product surfaces just because they come from different login or connector flows

This PRD does **not** require every future profile field to be implemented now.
It does require that:
- the first-class profile model exists
- country/language/timezone have a canonical home
- future profile richness extends Berlin's owned model instead of creating more soup

### Rich profile and global context (hard rule)

Clickeen is PLG and global.

Therefore Berlin must own the normalized user/account context that lets the product adapt to:
- who the person is
- what business/account they represent
- what country/market they operate in
- what language they prefer
- what external platforms they use
- what growth motion or lifecycle stage they are likely in

The important distinction is not "minimal profile" vs "rich profile".
The distinction is:
- one canonical owned profile/account model in Berlin
- versus scattered profile facts leaking from login handlers, Roma UI, Bob assumptions, Michael direct reads, or connector payloads

### Signup model (hard rule)

On first successful signup/sign-in:
1. create the user profile
2. create the first account
3. create the first account membership as `owner`
4. resolve the active account bootstrap snapshot

Signup must never leave the system in a state where:
- the user exists but has no profile
- the account exists but has no owner
- the user is authenticated but no active account can be resolved

### Invitation and membership creation model (hard rule)

Invitation is a core account-management primitive, not optional team CRUD.

Inviting a person is how an account grants access to another person and turns that person into an account member.

Berlin owns:
- invitation issuance
- invitation persistence
- invitation expiry/revocation
- invitation acceptance
- dedupe against existing user profiles / linked identities
- conversion of an accepted invitation into exactly one account membership

Hard rules:
- an accepted invitation must either resolve an existing `User Profile` or create a new one, then create the membership once
- accepting an invitation must never create duplicate people because account context or sign-in route differs
- Roma may render invitation UX, but Berlin owns invitation truth and membership creation
- invitation must remain part of the same closed Berlin account system as profile/account/membership/switch
- invitation is the canonical path for granting access to a person who is not already an attached account member
- direct member creation must not become a second invitation system

### Membership and team model (hard rule)

An account may contain multiple user profiles through account memberships.

Rules:
- one user profile may belong to many accounts
- one account may contain many user profiles
- each relationship is an `Account Membership`
- every membership has a role
- exactly one membership is the current `owner`

Tier/entitlement implication:
- owner/admin team-management capabilities resolve from role semantics plus the current tier and entitlements snapshot
- member limits are enforced from Berlin-owned account truth, not ad hoc in product surfaces

This must be reflected in both runtime and UX:
- `My Profile` = the person
- `Account Settings` = the business/account surface
- `Team` = the set of user profiles attached to the account through memberships

Roma may render those screens, but Berlin owns the model and mutations.

### Team domain and member detail model (hard rule)

Roma `Team` is the account-scoped member-management domain.

High-level model:
- the Team root shows all current user profiles attached to the current account through memberships
- pending invitations may appear in the Team domain, but they do not replace the member list
- depending on the current user's role x entitlements, a member row may drill into a member detail page

Member detail page:
- shows the selected person's membership in the current account
- shows the Berlin-owned profile fields relevant to account operations
- is the place where authorized users manage that person's membership and allowed profile fields

Hard rules:
- owner/admin are the mutation-capable roles for Team management
- viewer/editor do not perform Team-domain mutations
- Team detail must separate:
  - membership data for this account
  - canonical user-profile data owned by Berlin
- if Team detail edits user profile fields, that mutation must go through Berlin's canonical user-profile boundary
- Team detail must **not** create account-local shadow profile fields just because the edit happens from an account-scoped surface
- if a Team-domain edit changes canonical person/profile data that may affect the same person in other accounts, the UX must make that global effect explicit

This pattern is required because a flat Team table is not enough once the product supports:
- invitations
- role changes
- multi-account users
- ownership transfer
- operational/admin/support workflows

### Baseline account role model (hard rule)

`owner / admin / editor / viewer` are table-stakes account roles.
They should stay boring, explicit, and easy to reason about.

Default role semantics:
- `viewer` = can view and comment; cannot create, edit, manage team, or manage billing
- `editor` = viewer + can create and edit widgets/content
- `admin` = editor + can invite/manage members and manage normal account settings
- `owner` = admin + is the final accountable holder of the account; can manage billing/tier, transfer ownership, delete the account, and exercise final account control

Hard rules:
- these roles are **membership semantics**, not pricing/packaging semantics
- Berlin owns the canonical meaning of `owner / admin / editor / viewer`
- Roma may render the role UX, but must not redefine what the roles mean
- DevStudio may inspect or act on account roles, but it must not redefine them either
- `owner` is different in kind, not only degree: the account belongs to the owner
- `admin` has strong operational control, but is not the final holder of the account

Entitlements rule:
- entitlements do **not** replace roles
- entitlements constrain what the current account/tier/package allows
- effective runtime capability is therefore: `membership role x Berlin-resolved entitlements`

Examples:
- an `owner` may have the right to manage team, but seat caps still come from entitlements
- an `editor` may create/edit, but does not get billing/owner powers just because the tier is high
- a `viewer` stays read/comment-only even if the account is on the highest tier
- an `admin` may operate team/settings, but only the `owner` can transfer ownership or delete the account

Do not turn these table-stakes roles into a theory project.
Define them once, keep them boring, and let entitlements constrain them where packaging requires it.

### Multi-account membership model (hard rule)

The same person may belong to multiple accounts without becoming multiple product users.

Example:
- Mark is invited to Account A
- Mark signs up with Gmail
- Berlin creates or resolves one `User Profile` for Mark
- Berlin creates one `Account Membership` for Mark in Account A
- two months later Mark is invited to Account B
- Berlin creates a second `Account Membership` for the same `User Profile`

Hard rules:
- inviting the same person into a second account must never create a duplicate person/profile just because the account is different
- provider-linked identity remains attached to the person, not duplicated per account
- account-specific truth remains account-scoped: role, tier, locales, entitlements, widgets, assets, and team visibility are resolved from the active account context
- one person may therefore be `editor` in Account A and `viewer` or `admin` in Account B with no ambiguity in the core model

This means the runtime model is:
- one `User Profile`
- many `Account Memberships`
- exactly one active account context at a time

### Person-level account creation model (hard rule)

Creating a brand new account is a **person capability**, not a permission that should depend on being the owner of some other account.

Example:
- Mark is `editor` in Account A
- Mark chooses `Create New Account`
- Berlin creates Account B
- Berlin creates Mark's first membership in Account B as `owner`
- Mark remains `editor` in Account A and becomes `owner` in Account B

Hard rules:
- being non-owner in Account A must not block the same person from creating a brand new Account B that they own
- permissions inside an existing account are membership-scoped
- creating a new account is evaluated at the person/platform level, not as an ownership capability of the currently active account
- creating Account B must not grant any new rights inside Account A

This distinction is important:
- `What can this person do inside Account A?` -> membership/role question
- `Can this person create a new account they will own?` -> person/platform question

The product should therefore allow a user who is viewer/editor/admin in one account to also become owner of another account, provided platform/account-creation policy allows it.

### Active account switch model (hard rule)

If a user belongs to more than one account, the product must expose an explicit **Switch Account** capability.

Rules:
- Berlin owns the active-account switch contract
- Roma owns the product-shell UX for exposing account switching
- Bob never owns account switching UX or business logic
- account switching changes the active bootstrap context, not the underlying person/profile
- after a switch, the next Berlin bootstrap must return the new active account, role, tier, locale policy, entitlements snapshot, and account capsule for that account

UX rule:
- this capability may first appear in Settings or account shell UI during execution
- but architecturally it is an account-shell capability, not a settings-only special case

### Future company-plane model (hard rule)

This PRD defines the boring customer/product account boundary.
It does **not** define the future company-plane authority model for internal support, moderation, or commercial actions.

Hard rules:
- do not solve future internal/company authority by adding Clickeen humans to many or all customer accounts
- do not collapse company-plane authority into Berlin-owned customer memberships + active-account switching
- do not default to hidden impersonation/backdoor flows for internal company actions
- if a future company-plane architecture is needed, define it separately instead of stretching the customer account model until it breaks
- regional assignment (for example all accounts in Italy) must still result in ordinary per-account memberships that resolve through the same active-account bootstrap model
- account access remains account-scoped and auditable: the system must always know which account context the human is acting inside

Why this rule exists:
- it keeps permissions boring
- it keeps support/admin operations scalable
- it avoids inventing special-case employee access paths later
- it ensures Bob/Roma/other product surfaces continue to work from the same active-account truth instead of learning "special staff modes"

If a future support-specific role or operational role is needed, it must extend the Berlin-owned membership/policy model.
It must not create a parallel access system outside the membership model.

### DevStudio toolbench model (hard rule)

DevStudio is not a second customer account-management product.
DevStudio is the **internal toolbench**.

That means DevStudio is how a human manages:
- curated/platform-owned content and instances
- internal widget authoring and verification
- platform/runtime inspection
- explicit internal tooling that does not belong in Roma

Surface split:
- Roma = account-scoped member shell for normal account users
- DevStudio = internal toolbench for Clickeen itself

Hard rules:
- DevStudio must still use Berlin as the canonical user/account/membership/provider truth boundary
- DevStudio must not invent a second account model, second membership model, or second provider model
- DevStudio must not become a browse-all-accounts shell or fake customer-account browser
- DevStudio local must use its explicit internal-tool contract only on `/api/devstudio/*`
- DevStudio local authority must never be treated as product identity, account membership, or account-switch authority
- company-plane actions such as support intervention, moderation, and commercial overrides are not solved here; they are handled separately by PRD 066 / PRD 067

Current simplification:
- one internal human uses DevStudio directly as the internal toolbench
- we do **not** need a DevStudio capability matrix for PRD 064
- we do **not** solve future company-plane authority by stuffing global admin power into Berlin in this PRD

Why this matters:
- DevStudio must stay useful for internal work without becoming Roma 2
- Berlin must stay the boring product boundary
- future internal control-plane work must stay separate from the product account model

### Google-seeded profile model (hard rule)

Google/OIDC is used to **seed** the profile, not to become the product profile database.

Berlin captures from Google:
- provider subject (`sub`)
- email
- email verified
- name / given name / family name

Berlin then owns the product profile after first sign-in.

Do not store raw Google payload blobs as product truth.

Google/OIDC may provide more than the initial product profile needs.
Berlin's job is:
- capture the durable identity linkage
- seed the first profile values
- normalize what is useful
- reject the rest as raw provider noise

### Provider relationship reuse model (hard rule)

For providers that can act as both:
- sign-in identity providers
- and later product/data/connectors providers

Berlin must treat the first provider login as the beginning of a **durable provider relationship**, not as a disposable auth event.

This is crucial for Clickeen.

Examples:
- user signs up with Google -> Berlin captures the Google-linked identity and provider relationship -> later the account wants Google Reviews / Google Places-backed functionality -> Berlin reuses or upgrades the same Google relationship instead of creating a parallel Google auth system
- user signs up with Facebook -> Berlin captures the Meta-linked identity and provider relationship -> later the account wants Instagram Feed / Meta-backed functionality -> Berlin reuses or upgrades the same Meta relationship instead of inventing a second Meta auth path

Berlin must distinguish three related but separate concepts:
- `Linked Identity` = user-level fact that this person is linked to a provider account
- `Workspace Connection` = account-level reusable provider connection that product capabilities can reference
- `Capability / Scope State` = what that provider relationship is currently allowed to do

Execution rule:
- these are required conceptual distinctions
- they are **not** a requirement to build three separate subsystems/tables/code paths immediately
- implement the simplest data shape that preserves the distinctions needed for current providers and flows
- only split the model further if runtime needs prove the extra structure is necessary

Hard rules:
- social login is not only session bootstrap; it can seed the first durable provider relationship
- later widget/product capabilities for the same provider must first attempt to reuse that existing provider relationship
- if later product capability needs broader scopes than the original login granted, Berlin upgrades the same relationship via incremental consent instead of creating a parallel provider integration model
- widgets and product surfaces must never store provider tokens, refresh tokens, or raw OAuth payloads in instance config
- widgets reference Berlin-owned connection/capability state, not provider internals

This is the anti-soup rule in concrete form:
- one Google relationship for Google identity + future Google-powered product capabilities
- one Meta relationship for Meta identity + future Meta-powered product capabilities
- one Berlin-owned upgrade path when new scopes/capabilities are needed
- zero per-widget/provider auth mini-systems

### Connectors model (hard rule)

Connectors are external linked systems that tell Clickeen who the user/account is and what they do.

Examples:
- Google
- Facebook / Instagram
- TikTok
- X
- Apple
- later: website / analytics / commerce connectors

Berlin owns:
- connector linkage
- connector state
- normalization of raw connector payloads into durable product concepts

For providers that overlap with login identity providers, connector ownership must compose with the provider relationship reuse model above instead of bypassing it.

That means:
- login-linked provider identity can seed the first reusable connector relationship
- later connector-capability requests reuse that relationship when possible
- Berlin is the only boundary allowed to decide whether the current provider relationship already satisfies the requested capability or must be upgraded with broader scopes/permissions
- no widget, Roma flow, Bob flow, or leaf service may start its own provider-specific auth model just because it needs a provider-backed feature months later

Berlin must normalize connectors into concepts such as:
- linked identities
- account traits
- market/language signals
- platform presence
- business intent
- lifecycle stage

This is why connectors work closely with Berlin:
- connectors extend identity and account understanding
- connectors do not belong in widget services or UI shells
- connectors should enrich one canonical user/account brain, not create parallel partial truths
- connectors let one provider relationship compound over time across onboarding, profile/account intelligence, and later product capabilities
- Berlin is the only place that can manage provider linkage, workspace reuse, scope upgrades, token lifecycle, and normalized traits without cross-service duplication

Berlin is therefore not only the auth service.
Berlin is the normalizer and manager of identity, account, and connected external context.

Do not let raw connector payloads leak across Roma, Bob, Paris, Tokyo, Venice, Prague, or San Francisco.
Do not let provider reuse/upgrade logic leak across those services either.

### Berlin is a truth boundary, not a decisioning plane (hard rule)

Berlin owns durable facts and normalized traits.

Berlin should return truths such as:
- profile facts
- memberships
- active account context
- locale policy
- entitlements snapshot
- normalized provider/account traits

Berlin must **not** become the downstream product-decisioning plane for:
- recommendation ranking
- growth prompt selection
- support-action orchestration
- widget suggestion logic
- lifecycle automation decisions

Other systems may consume Berlin-normalized truth to make those decisions.
Berlin's job is to normalize and return canonical facts, not to become a general product brain.

---

## Documentation decision (locked)

Account management must get a **dedicated architecture document**.

We will add:
- `documentation/architecture/AccountManagement.md`

We will also update:
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/devstudio.md`
- `documentation/services/bob.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/capabilities/multitenancy.md`

Hard documentation rule:
- `AccountManagement.md` must document:
  - user profile
  - account
  - membership / owner invariant
  - baseline account roles (`owner/admin/editor/viewer`)
  - role x entitlements rule
  - signup model
  - `My Profile` vs `Account Settings` UX model
  - team/membership UX and owner transfer model
  - Roma vs DevStudio surface split
  - bootstrap model
  - connector model
  - normalized account-intelligence concepts
  - ownership boundaries
- `multitenancy.md` documents tenancy and roles/tier packaging only
- it must not pretend to be the account-management architecture doc
- `berlin.md` documents Berlin as a service, not the whole account-management system by itself

If `AccountManagement.md` does not exist by the end of this PRD, the PRD is not done.

---

## Target runtime shape

### Canonical bootstrap

`GET /v1/session/bootstrap`

Returns:
- user
- user profile
- accessible accounts summary for shell/account-switch context
- active account
- membership role
- account tier
- account locale policy
- entitlements snapshot
- normalized connector/account traits needed at bootstrap time
- signed account capsule

### Canonical account API

Berlin owns a narrow account API:

- `GET /v1/me`
- `PUT /v1/me`
- `GET /v1/me/identities`
- `GET /v1/accounts`
- `POST /v1/accounts`
- `GET /v1/accounts/:id`
- `DELETE /v1/accounts/:id`
- `GET /v1/accounts/:id/members`
- `GET /v1/accounts/:id/members/:memberId`
- `GET /v1/accounts/:id/invitations`
- `POST /v1/accounts/:id/invitations`
- `DELETE /v1/accounts/:id/invitations/:invitationId`
- `POST /v1/invitations/:token/accept`
- `POST /v1/accounts/:id/members`
- `PATCH /v1/accounts/:id/members/:memberId`
- `PATCH /v1/accounts/:id/members/:memberId/profile`
- `POST /v1/accounts/:id/owner-transfer`
- `PUT /v1/accounts/:id/locales`
- `PUT /v1/accounts/:id/tier`
- `POST /v1/accounts/:id/switch`

`POST /v1/accounts/:id/switch` is not optional garnish.
It is the canonical active-account switch boundary for any user who holds memberships in more than one account.

Route authority rule:
- `POST /v1/accounts/:id/invitations` is the canonical grant-access path for inviting a person into an account
- `GET /v1/accounts/:id/members/:memberId` is the canonical Team member-detail boundary
- `POST /v1/accounts/:id/members` is allowed only for attaching an already-resolved existing user profile through canonical Berlin account flows
- `POST /v1/accounts/:id/members` must not become a second invitation/onboarding path for unknown people
- `PATCH /v1/accounts/:id/members/:memberId` mutates membership/account access state
- `PATCH /v1/accounts/:id/members/:memberId/profile` is the authorized Team-domain path for editing Berlin-owned user profile fields from account context
- `PATCH /v1/accounts/:id/members/:memberId/profile` must mutate canonical Berlin profile data, not account-local shadow fields
- `DELETE /v1/accounts/:id` is owner-only final account control and must not exist outside Berlin

This surface is intentionally small, but it must also be complete.
It must be complete enough that Roma/Bob never need side routes for:
- inviting a person
- accepting an invitation
- switching active account

Berlin must expose `GET /v1/accounts` and `POST /v1/accounts`, but Roma does not need a dedicated account-browser or account-create domain to satisfy that contract.
The normal product-shell shape is:
- bootstrap returns the accessible accounts summary for shell context
- the shell exposes account switching only when the user belongs to more than one account
- if product creates a new account from Roma, it does so as a small shell action or onboarding flow, not as a standalone `/accounts` destination

It must also be complete enough that DevStudio internal tool flows do not invent a second account-truth model on top.

Optional additive endpoints only if execution proves they are needed:
- connector read/write endpoints
- internal bulk membership-assignment endpoints for operational staff flows

Do not add speculative account endpoints “just in case.”

---

## Product-surface rules

### Roma

Roma:
- renders the account shell
- calls Berlin for account state and mutations
- may keep same-origin Next routes only where browser/cookie/host constraints require them
- exposes account switching in the product shell when the user has more than one account membership

If same-origin Roma routes remain, they must be:
- thin Berlin proxies only
- no independent account logic
- no direct Michael logic
- no entitlements logic

Roma is the normal customer/account member surface.
Roma does not become the global Clickeen management portal.

### DevStudio

DevStudio:
- is the internal toolbench for platform curation, internal authoring, and verification
- renders internal tool surfaces that do not belong in Roma
- may expose explicit internal tooling for Clickeen itself, but not a browse-all-accounts customer shell
- must still call Berlin-owned account contracts where canonical product/account truth is required
- must not create a second account-management runtime model or treat internal humans as privileged customer members

If DevStudio needs internal capabilities beyond Roma, those capabilities must be explicit and documented.
They must not be implemented as fake product memberships, fake account switching, or Berlin-owned universal superadmin authority.

### Bob

Bob:
- consumes the Berlin bootstrap result
- consumes the signed account capsule
- never owns account settings logic
- never reads account management state from scattered routes

### Michael

Michael:
- stores account data
- is never the product-facing account-management API

### Paris

Paris:
- has zero ownership of account management after this PRD

---

## Scope

1. Converge account/session/profile/bootstrap/team/locales/tier/entitlements onto Berlin.
2. Move Roma account settings/team/account-shell reads/writes to Berlin-owned contracts.
3. Remove fake DevStudio account-shell/account-browser shapes and keep only the legitimate internal toolbench routes on canonical product truth.
4. Move Bob/Builder account bootstrap dependencies to the single Berlin bootstrap contract.
5. Define and implement the user-profile and owner invariant model.
6. Define the connector ownership/normalization model under Berlin.
7. Remove non-canonical account-management route families and duplicated logic in Roma/Bob/DevStudio/Paris.
8. Write proper account-management documentation.

## Out of scope

1. Widget save/publish/write-plane redesign.
2. Translation pipeline redesign.
3. Asset pipeline redesign.
4. Michael schema redesign beyond what is needed to support the clean account boundary.
5. New billing platform architecture.
6. Enterprise IAM/SAML/SCIM.
7. Reopening PRD 61 or PRD 63 scope.
8. Implementing every future connector in this PRD.
9. Backward-compatibility shims, dual-read support, or dual-write support for the fragmented account model.

---

## Current failures this PRD must eliminate

Examples of the current broken state:

1. Roma Settings can fail auth and render a fake locale-selection shell.
2. DevStudio/Bob can show account locale truth while Roma Settings shows something else.
3. Roma Builder boot can fail on account/member/bootstrap paths independently from DevStudio.
4. Different surfaces can resolve account membership/role/tier/entitlements through different code paths.

If any of those survive after execution, PRD 064 is not done.

---

## Concrete dependency map (pre-execution inventory)

This PRD must execute against the real current residue, not only the target architecture.

This inventory is the minimum dependency map already confirmed in the codebase.
If execution discovers additional live account-management residue, that residue must be added to this map and converged or deleted before the owning phase can close.

### Bootstrap residue to converge or delete

Current legacy bootstrap path:
- `roma/app/api/bootstrap/route.ts` -> same-origin proxy to Paris `/api/roma/bootstrap`
- `roma/app/api/session/finish/route.ts` -> post-auth flow currently fetches Paris `/api/roma/bootstrap`
- `bob/app/api/roma/bootstrap/route.ts` -> CORS proxy to Paris `/api/roma/bootstrap`
- `bob/lib/session/useWidgetSession.tsx` -> currently fetches `/api/roma/bootstrap`
- `paris/src/domains/roma/widgets-bootstrap.ts` -> current bootstrap/account-shaping handler
- `paris/src/domains/roma/index.ts` -> exports Roma bootstrap handlers
- `paris/src/domains/identity/index.ts` -> `resolveIdentityMePayload()` currently participates in account/member resolution
- `paris/src/index.ts` -> mounts `/api/roma/bootstrap`

Target:
- bootstrap/account shaping moves to Berlin `GET /v1/session/bootstrap`
- Roma/Bob consume Berlin bootstrap directly or through a documented thin Berlin proxy only where host/cookie constraints require it
- Paris bootstrap route family is deleted

### Roma direct Michael and same-origin account route residue

Current Roma account-management residue:
- `roma/lib/michael.ts` -> `listAccountMembersForAccount()` direct Michael read
- `roma/lib/michael.ts` -> `getAccountLocalesRow()` direct Michael read
- `roma/app/api/accounts/[accountId]/members/route.ts` -> direct Michael-backed Team list route
- `roma/app/api/accounts/[accountId]/locales/route.ts` -> GET reads Michael directly, PUT proxies to Paris
- `roma/app/api/accounts/[accountId]/lifecycle/plan-change/route.ts` -> proxies to Paris
- `roma/app/api/accounts/[accountId]/lifecycle/tier-drop/dismiss/route.ts` -> proxies to Paris
- `roma/components/team-domain.tsx` -> currently consumes the Roma members route
- `roma/components/account-locale-settings-card.tsx` -> currently consumes the Roma locales path / Paris locales write path
- `roma/components/settings-domain.tsx` -> currently submits plan change through Paris-backed route
- `roma/components/roma-account-notice-modal.tsx` -> currently submits tier-drop dismiss through Paris-backed route

Target:
- Roma account routes become Berlin-owned reads/mutations or thin Berlin proxies only
- Roma no longer owns direct Michael reads, Paris proxies, or account logic
- Team list -> member detail -> membership/profile edits all resolve through canonical Berlin contracts

### Bob account/bootstrap residue to converge or delete

Current Bob account residue:
- `bob/app/api/roma/bootstrap/route.ts` -> Paris bootstrap proxy
- `bob/lib/session/useWidgetSession.tsx` -> depends on `/api/roma/bootstrap`
- `bob/lib/michael.ts` -> `getAccountLocalesRow()` direct Michael account read helper
- `bob/lib/michael.ts` -> `listAccountMembersForAccount()` direct Michael account membership helper

Target:
- Bob boot/gating resolves only from Berlin bootstrap + Berlin-signed account capsule
- Bob no longer depends on `/api/roma/bootstrap`
- Bob account membership/locales helpers are removed from `bob/lib/michael.ts`

### Paris bootstrap/account-management residue to delete or clarify

Current Paris account/bootstrap residue:
- `paris/src/domains/identity/index.ts` account/member shaping used by bootstrap
- `paris/src/domains/accounts/index.ts` -> account create / lifecycle account routes
- `paris/src/domains/l10n/account-handlers.ts` / `paris/src/domains/l10n/index.ts` -> old flat account-locales ownership is removed; internal aftermath + instance/l10n orchestration may remain
- `paris/src/domains/roma/widgets-bootstrap.ts` / `paris/src/domains/roma/index.ts` -> delete bootstrap-only residue; keep active Roma widgets/templates/delete handlers if they remain legitimate non-account-management Paris runtime
- `paris/src/index.ts` -> bootstrap / account create / lifecycle mounts removed; explicit instance/l10n orchestration mounts may remain when they no longer shape account/member/bootstrap truth

Target:
- Paris has zero ownership of account management or bootstrap runtime behavior
- Paris may retain explicit instance/l10n orchestration and internal aftermath routes only when account truth is already resolved in Berlin and Paris is not shaping account/member/bootstrap state

### Documentation residue to converge

Current documentation/runtime teaching residue already visible in code/docs:
- `paris/README.md` still documents `/api/roma/bootstrap` and Paris-owned account locales routes

Target:
- docs stop teaching Paris bootstrap/account ownership
- docs match the Berlin-owned boundary before phase closeout

---

## Execution order

### Phase 1 — Freeze the account model in docs

Write `documentation/architecture/AccountManagement.md` and update the affected docs so the repo teaches one model:
- Berlin = identity + account intelligence API
- Michael = persistence
- Roma = UI only
- Bob = consumer only
- Paris = out

Done when:
- no active doc still describes account management as a distributed concern
- `multitenancy.md` no longer carries account-management architecture responsibilities
- `berlin.md` and `CONTEXT.md` match the new ownership model
- `AccountManagement.md` explicitly covers user profile, owner invariant, baseline roles, role x entitlements, membership model, `My Profile` vs `Account Settings`, and connectors
- `AccountManagement.md` explicitly covers the Team list -> member detail model and the distinction between membership edits and canonical profile edits
- the concrete dependency map in this PRD is still accurate for the known live residue or is updated before execution continues

### Phase 2 — Define and implement the user profile + owner invariant + baseline role model

Implement the canonical model:
- user profile
- account
- membership
- owner invariant
- baseline role model (`owner/admin/editor/viewer`)
- signup creates first account + owner membership

Done when:
- every account always has an owner
- first sign-in produces a valid user profile + account + owner membership state
- owner/admin distinction is explicit in runtime behavior
- there is no ownerless account state in runtime behavior
- the baseline role model exists before Roma/DevStudio convergence depends on it

### Phase 3 — Define and implement the canonical Berlin bootstrap contract

Build `GET /v1/session/bootstrap` in Berlin with:
- user
- user profile
- active account
- role
- tier
- account locale policy
- entitlements snapshot
- normalized connector/account traits required by product surfaces
- signed account capsule

Done when:
- Roma and Bob can both consume one bootstrap result
- no parallel bootstrap account-shaping logic remains elsewhere
- `roma/app/api/bootstrap/route.ts`, `roma/app/api/session/finish/route.ts`, `bob/app/api/roma/bootstrap/route.ts`, `bob/lib/session/useWidgetSession.tsx`, `paris/src/domains/roma/widgets-bootstrap.ts`, `paris/src/domains/roma/index.ts`, `paris/src/domains/identity/index.ts`, and the `/api/roma/bootstrap` mount in `paris/src/index.ts` are converged or explicitly queued for deletion in the immediately following removal phase with no remaining runtime dependence on Paris bootstrap shaping

### Phase 4 — Move Roma account management to Berlin

Converge Roma settings/team/account-shell routes onto Berlin, including:
- invitation flows
- accept invitation handoff
- account switching
- Team list and Team member detail flows

Rules:
- thin same-origin proxy allowed only if browser/cookie/host requires it
- no business logic in Roma account routes
- every touched Roma account path must either become a thin Berlin proxy or be deleted in the same phase

Done when:
- Roma Settings, Team, and account shell read/write through Berlin-owned account contracts only
- Roma has no independent account-management logic
- Roma does not introduce a standalone account-browser or account-create domain just to mirror Berlin capabilities
- Team member detail mutations route through Berlin-owned membership/profile contracts only
- `roma/lib/michael.ts` no longer carries live account-members/locales reads used by Roma account behavior
- `roma/app/api/accounts/[accountId]/members/route.ts`, `roma/app/api/accounts/[accountId]/locales/route.ts`, `roma/app/api/accounts/[accountId]/lifecycle/plan-change/route.ts`, and `roma/app/api/accounts/[accountId]/lifecycle/tier-drop/dismiss/route.ts` are either deleted or reduced to thin Berlin proxies only
- `roma/components/team-domain.tsx`, `roma/components/account-locale-settings-card.tsx`, `roma/components/settings-domain.tsx`, and `roma/components/roma-account-notice-modal.tsx` no longer depend on Michael-backed or Paris-backed account paths

### Phase 5 — Converge DevStudio toolbench flows onto Berlin truth

Converge legitimate DevStudio toolbench flows onto the same Berlin truth model while removing fake account-shell/operator shapes.

Done when:
- DevStudio does not carry a second account/membership/provider architecture
- fake DevStudio account-management/account-browser/operator surfaces are deleted
- any surviving DevStudio path that needs product/account truth reads/writes through Berlin-owned truth or explicit internal tool contracts only
- `GET /api/devstudio/context` uses the explicit host-owned DevStudio contract for the environment; it is never treated as customer product identity, account switch, or product membership authority
- `GET /api/devstudio/instances` and `GET /api/devstudio/instances/:publicId/l10n/status` enforce that same host-owned context decision before proxying upstream work
- if additional DevStudio account residue is discovered during implementation, it is added to the concrete dependency map before the phase is considered complete

### Phase 6 — Move Bob/Builder account context to Berlin bootstrap only

Converge Bob/Builder account boot and gating to:
- Berlin bootstrap snapshot
- Berlin-signed account capsule

Done when:
- Bob account/session/bootstrap behavior comes from one account contract
- Bob no longer depends on scattered account/membership/locales logic
- no Bob fallback/bootstrap shaping remains for legacy account paths
- `bob/app/api/roma/bootstrap/route.ts` and the `/api/roma/bootstrap` call in `bob/lib/session/useWidgetSession.tsx` are removed or reduced to Berlin-only proxy behavior
- `bob/lib/michael.ts` no longer carries live account-members/locales helpers for Bob account behavior

### Phase 7 — Define connector ownership and normalization under Berlin

Lock the connector model:
- Berlin owns connector linkage/state
- Berlin normalizes connector payloads
- other services consume normalized truth only
- provider distinctions are preserved conceptually, but implemented with the simplest data shape that satisfies current needs

Done when:
- connector ownership is explicit in runtime and docs
- no product surface treats raw connector payloads as its own data model
- the provider reuse model does not become a speculative three-subsystem architecture before runtime needs it

### Phase 8 — Remove non-canonical account routes and logic

Delete:
- direct product-surface account-management reads from Michael
- Paris-owned account-management route residue
- duplicated Roma/Bob/DevStudio account route logic
- legacy compatibility shims, dual-read paths, and dual-write paths kept for the fragmented account model
- the concrete dependency-map files listed above when they remain on the old model

Done when:
- there is one account-management boundary in runtime
- Michael is persistence only
- Paris is absent from account-management runtime behavior
- no touched workflow still relies on a back-compat path to the old account model
- `paris/src/domains/accounts/index.ts`, `paris/src/domains/identity/index.ts`, any bootstrap-only residue inside `paris/src/domains/roma/widgets-bootstrap.ts` / `paris/src/domains/roma/index.ts`, the old account/bootstrap mounts in `paris/src/index.ts`, and any equivalent legacy residue named in the dependency map are deleted or provably inactive for account runtime behavior
- any surviving `paris/src/domains/l10n/account-handlers.ts`, `paris/src/domains/l10n/index.ts`, or `paris/src/domains/account-instances/*` usage is limited to explicit instance/l10n orchestration after Berlin has already resolved account truth

### Phase 9 — Documentation closeout

Update:
- `documentation/architecture/AccountManagement.md`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/devstudio.md`
- `documentation/services/bob.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/capabilities/multitenancy.md`
- `paris/README.md`

Done when docs teach one truth, match runtime, and no active doc still teaches Paris/bootstrap/Michael ownership for account behavior.

---

## Execution checklist (cross-surface reference)

Use this checklist while executing PRD 064.
Do not start or close a phase by intuition; walk the checklist and the dependency map.

### Global execution checklist

- [ ] Declare the active phase and exact workflow being touched before editing code.
- [ ] Read the concrete dependency map for that workflow and add any newly discovered residue before implementation continues.
- [ ] Implement the Berlin-owned contract/model first; do not start in Roma, DevStudio, Bob, or Paris.
- [ ] Converge every touched dependent consumer in the same phase across Roma, DevStudio, Bob, Paris residue, docs, and any Michael access helper involved in that workflow.
- [ ] Delete or reduce the old path to a documented thin Berlin proxy in the same phase; do not keep dual-read, dual-write, fallback, or back-compat shims.
- [ ] Verify in `local` first using the canonical startup `bash scripts/dev-up.sh`.
- [ ] If the workflow exists in shared runtime, apply the same cutover to `cloud-dev` after `local` is correct.
- [ ] Update the dependency map and documentation whenever execution discovers a new live path or changes ownership.
- [ ] Do not begin the next phase while the current phase still leaves live old-model residue for the touched workflows.

### Execution-slice checklist

Every execution slice for this PRD must explicitly record:
- [ ] active phase
- [ ] Berlin contracts/models added or changed
- [ ] dependent files/routes/surfaces being converged
- [ ] old files/routes being deleted or reduced to thin Berlin proxies
- [ ] `local` verification performed
- [ ] `cloud-dev` follow-through performed or intentionally deferred with reason

### Phase 1 checklist — Docs freeze

- [ ] `documentation/architecture/AccountManagement.md` exists and teaches the final model.
- [ ] `documentation/services/berlin.md`, `documentation/services/roma.md`, `documentation/services/devstudio.md`, `documentation/services/bob.md`, `documentation/architecture/CONTEXT.md`, and `documentation/capabilities/multitenancy.md` align with the PRD.
- [ ] the dependency map in this PRD is current enough to drive execution without hidden residue.

### Phase 2 checklist — Berlin core account model

- [ ] Berlin owns the canonical `User Profile`, `Account`, and `Account Membership` model.
- [ ] the owner invariant is enforced and there is exactly one owner per account at runtime.
- [ ] the baseline role model (`owner/admin/editor/viewer`) is implemented as Berlin-owned membership semantics.
- [ ] signup creates user profile + first account + owner membership + active account state atomically enough to avoid half-created runtime states.
- [ ] no other surface still infers or owns profile/owner/role semantics independently.

### Phase 3 checklist — Canonical Berlin bootstrap

- [ ] `GET /v1/session/bootstrap` is implemented in Berlin.
- [ ] bootstrap returns accessible accounts summary, active account, role, tier, locale policy, entitlements snapshot, normalized bootstrap traits, and signed account capsule.
- [ ] Roma bootstrap consumption is moved off Paris bootstrap shaping.
- [ ] Bob bootstrap consumption is moved off Paris bootstrap shaping.
- [ ] `paris/src/domains/roma/widgets-bootstrap.ts`, `paris/src/domains/roma/index.ts`, `paris/src/domains/identity/index.ts`, and the `/api/roma/bootstrap` mount in `paris/src/index.ts` are deleted or made provably inactive for runtime.
- [ ] no runtime call still depends on Paris `/api/roma/bootstrap`.

### Phase 4 checklist — Roma cutover

- [ ] Roma account shell uses Berlin for invite, accept invite handoff, switch account, Team list, Team member detail, locales, tier, and account settings.
- [ ] if Roma exposes account creation, it is a minimal shell or onboarding action backed by Berlin, not a standalone account-browser or `/accounts` domain.
- [ ] owner/admin/editor/viewer behavior in Roma resolves from Berlin role semantics x entitlements, not from Roma-local logic.
- [ ] `roma/app/api/accounts/[accountId]/members/route.ts`, `roma/app/api/accounts/[accountId]/locales/route.ts`, `roma/app/api/accounts/[accountId]/lifecycle/plan-change/route.ts`, and `roma/app/api/accounts/[accountId]/lifecycle/tier-drop/dismiss/route.ts` are deleted or reduced to thin Berlin proxies only.
- [ ] `roma/lib/michael.ts` no longer provides live account-members/locales behavior for Roma account workflows.
- [ ] `roma/components/team-domain.tsx`, `roma/components/account-locale-settings-card.tsx`, `roma/components/settings-domain.tsx`, and `roma/components/roma-account-notice-modal.tsx` no longer depend on Michael-backed or Paris-backed account behavior.
- [ ] Team member detail edits canonical profile data only through Berlin and does not create shadow profile fields.

### Phase 5 checklist — DevStudio cutover

- [ ] DevStudio internal tool/account-like flows are inventoried before cutover, not discovered ad hoc during coding.
- [ ] every surviving DevStudio path that needs product/account truth reads/writes through Berlin-owned truth or explicit internal tool contracts only.
- [ ] DevStudio does not introduce a second account, membership, or provider model.
- [ ] any DevStudio residue discovered during implementation is added back into the dependency map before the phase is closed.

### Phase 6 checklist — Bob cutover

- [ ] Bob boot and gating resolve only from Berlin bootstrap + Berlin-signed account capsule.
- [ ] `bob/app/api/roma/bootstrap/route.ts` is deleted or reduced to a Berlin-only proxy.
- [ ] `bob/lib/session/useWidgetSession.tsx` no longer depends on `/api/roma/bootstrap`.
- [ ] `bob/lib/michael.ts` no longer provides live account-members/locales helpers for Bob account behavior.
- [ ] Bob does not reintroduce account shaping, fallback account logic, or scattered membership/locales reads.

### Phase 7 checklist — Connector/provider convergence

- [ ] provider reuse and incremental scope upgrade live in Berlin.
- [ ] execution uses the simplest data shape that preserves `Linked Identity`, `Workspace Connection`, and `Capability / Scope State` distinctions needed now.
- [ ] no widget, Roma flow, Bob flow, or leaf service starts a provider-specific auth mini-system.
- [ ] raw provider payloads and provider tokens do not become product-surface data models.

### Phase 8 checklist — Legacy destruction sweep

- [ ] the dependency map is walked item-by-item.
- [ ] Paris account/bootstrap/locales/lifecycle residue is deleted or proven inactive.
- [ ] Roma/Bob/DevStudio old-model account residue is deleted or proven inactive.
- [ ] direct product-surface Michael reads for account behavior are removed.
- [ ] no fallback, dual-read, dual-write, or compatibility shim remains for the fragmented account model.

### Phase 9 checklist — Documentation closeout

- [ ] all docs named in this PRD are updated to match the final runtime shape.
- [ ] `paris/README.md` no longer teaches Paris bootstrap/account ownership.
- [ ] docs reflect the actual `local` execution state.
- [ ] docs reflect the actual `cloud-dev` execution state after rollout.

---

## Final closeout punch list

Use this as the single remaining signoff list after the main Berlin/Roma/Bob cutover is already in place.

### 1. DevStudio toolbench truth enforcement

- [ ] `GET /api/devstudio/context` uses the explicit host-owned DevStudio contract for the environment and fails visibly when that contract cannot be resolved.
- [ ] in `local`, DevStudio uses only its explicit `local-tool` contract on `/api/devstudio/*`; it is never treated as product session, account membership, or account-switch authority.
- [ ] `GET /api/devstudio/instances` and `GET /api/devstudio/instances/:publicId/l10n/status` enforce the same host-owned context decision before any upstream proxy work.
- [ ] DevStudio docs state the real behavior, not the desired behavior.

### 2. Paris dead account residue destruction

- [ ] delete dead Paris account-management/bootstrap residue that no longer has runtime ownership:
  `paris/src/domains/accounts/index.ts`
  `paris/src/domains/identity/index.ts`
- [ ] remove any remaining bootstrap-only residue from `paris/src/domains/roma/widgets-bootstrap.ts` / `paris/src/domains/roma/index.ts` if execution finds historical bootstrap branches still present.
- [ ] do **not** delete legitimate Paris instance/l10n orchestration just because the routes are account-scoped; only delete code that still owns account/member/bootstrap truth.

### 3. Roma proxy intent annotation

- [ ] thin same-origin Roma account routes carry one line explaining that they exist because browser/session cookies terminate on the Next host, not because Roma owns account logic.

### 4. Local signoff verification

- [ ] `pnpm exec tsc -p berlin/tsconfig.json`
- [ ] `pnpm --filter @clickeen/roma exec tsc --noEmit`
- [ ] `pnpm --filter @clickeen/roma lint`
- [ ] `pnpm --filter @clickeen/bob lint`
- [ ] `pnpm --filter @clickeen/devstudio test -- src/html/tools/dev-widget-workspace.test.ts`
- [ ] targeted Paris verification for the surviving localization/orchestration routes after dead-account residue is removed

### 5. Cloud-dev rollout and verification

- [ ] apply the PRD 64 migrations in shared dev
- [ ] deploy Berlin / Roma / Bob / Admin / Paris changes needed for this cutover
- [ ] verify cloud-dev no longer depends on Paris bootstrap or direct Michael account reads for account management
- [ ] verify the surviving Paris routes in cloud-dev are limited to explicit instance/l10n orchestration and internal aftermath

### 6. Exact cloud-dev rollout order

Execute in this order after `local` signoff is green:

1. Apply migrations in shared dev:
   - `20260311160000__prd64_user_profiles_and_owner_invariant.sql`
   - `20260311193000__prd64_active_account_preference.sql`
   - `20260311223000__prd64_account_invitations.sql`
   - `20260311232000__prd64_transfer_account_owner_rpc.sql`
2. Deploy Berlin first.
   - Berlin must ship before any shell depends on `/v1/me`, `/v1/accounts*`, `/v1/session/bootstrap`, invitations, owner transfer, locales, or tier routes.
3. Deploy Roma second.
   - Roma same-origin account shell routes must now relay only to Berlin for account management.
4. Deploy Bob third.
   - Bob must consume `/api/session/bootstrap` and the Berlin-backed capsule path, with no `/api/roma/bootstrap` dependency left.
5. Deploy DevStudio fourth.
   - DevStudio host context must use the explicit host-owned DevStudio contract for the environment; `local` uses the `local-tool` contract and shared runtime uses its real hosted contract.
6. Deploy Paris last.
   - Paris should retain only the legitimate orchestration/runtime routes that remain after account-management residue deletion.
7. Verify shared dev runtime in this order:
   - sign in and confirm first bootstrap resolves from Berlin
   - verify Roma `My Profile`, `Team`, `Settings`, invitations, account switching, and owner-only actions
   - verify Bob boot/gating on the new bootstrap path
   - verify DevStudio context, instance discovery, and l10n status behavior
   - verify Paris is absent from bootstrap/account-management runtime paths but still serves explicit instance/l10n orchestration

---

## Acceptance gates

1. One authenticated Berlin bootstrap call is enough to resolve:
- user
- user profile
- active account
- role
- tier
- locale policy
- entitlements snapshot
- normalized connector/account traits needed at bootstrap time
- signed account capsule

2. Roma Settings and DevStudio/Bob show the same account locale state for the same account.

3. Roma Builder opens using the same Berlin-owned account context model as the rest of the product shell.

4. If one person belongs to Account A and Account B, runtime resolves one shared user profile plus two memberships, not two separate users.

5. Switching from Account A to Account B changes the active Berlin bootstrap/account capsule context cleanly without duplicating user identity.

6. Berlin supports a person-level create-account contract, and if/when Roma exposes it, using it does not alter that person's rights in their existing accounts.

7. Internal DevStudio/company-plane authority is not modeled as ordinary Berlin account memberships or account switching.

8. DevStudio remains the internal toolbench and does not reintroduce a generic account browser, operator shell, or privileged-customer model.

9. Berlin owns the canonical contracts for listing accessible accounts, creating accounts, issuing invitations, accepting invitations, and switching accounts, and Roma/Bob do not recreate those workflows with side-route business logic or fake account-browser shells.

10. DevStudio acts as the internal toolbench while still relying on Berlin-owned truth where canonical product/account truth is required instead of a parallel account-management model.

11. Roma/customer account behavior uses one boring baseline role model (`owner/admin/editor/viewer`), and those role meanings are not redefined per surface.

12. Entitlements constrain account capabilities, but they do not replace account-role semantics; effective capability resolves as `role x entitlements`.

13. DevStudio does not depend on a customer-style capability matrix to function; it remains the internal toolbench and does not become a fake customer-account shell.

14. Signup produces:
- a user profile
- an account
- an owner membership
- an active account bootstrap state

15. No account can exist without an owner.

16. Team-management capabilities resolve from the canonical role model plus Berlin-resolved entitlements, and that behavior is not reimplemented separately in Roma.

17. Only the current owner can transfer ownership or delete the account; admin remains operational control, not account-holder authority.

18. Roma Team shows the full current member set for the active account and authorized users can drill into a Team member detail page through canonical Berlin account contracts.

19. Team member detail cleanly separates account membership data from canonical user-profile data.

20. Team-domain profile edits route through Berlin's canonical user-profile boundary and do not create account-local shadow profile fields.

21. No product surface reads account-management state directly from Michael.

22. Paris does not own account management.

23. Berlin is the explicit owner of connector linkage/state/normalization.

24. Berlin returns durable account/provider truth and normalized traits, while downstream product-decisioning stays outside Berlin.

25. For providers that support both sign-in and later product capabilities, Berlin reuses or incrementally upgrades one provider relationship instead of allowing separate per-widget/provider auth paths.

26. Unknown-person access enters through canonical invitation acceptance; direct member-create does not become a second invite/onboarding system.

27. Every touched account workflow has its dependent Roma/DevStudio/Bob/Michael/Paris/docs paths explicitly converged or removed; no split-brain runtime remains.

28. No backward-compatibility shim, dual-read path, dual-write path, or fallback to the fragmented account model remains after cutover.

29. `documentation/architecture/AccountManagement.md` exists and is referenced from the relevant service/context docs.

30. No active docs teach the old fragmented account-management story.

31. No runtime path still depends on Paris `/api/roma/bootstrap`; bootstrap/account shaping resolves from Berlin only.

32. No Roma Team/locales/account-settings behavior reads Michael directly or proxies account behavior to Paris.

33. No Bob account bootstrap/gating path depends on `/api/roma/bootstrap` or Bob-local Michael account helpers.

34. The concrete dependency-map files listed in this PRD have been converged, deleted, or proven inactive for account runtime behavior before signoff.

---

## Hard failure conditions

Stop execution if any of these appear:

1. Berlin starts absorbing widget/product business logic.
2. Berlin becomes a dumping ground for raw connector payload blobs instead of a normalizer.
3. Roma keeps account-management logic instead of becoming a UI shell.
4. Michael is still used directly by product surfaces for account-management behavior.
5. Paris remains on any account-management runtime path.
6. A “temporary” duplicate account route family is kept for safety.
7. We try to solve this by adding new glue layers instead of deleting old paths.
8. We attempt to document account management only by stretching `berlin.md` or `multitenancy.md`.
9. Rich user/account context is treated as optional product garnish instead of Berlin-owned product intelligence.
10. A widget/product surface starts its own provider-specific auth/connection path for a capability that should reuse or upgrade an existing Berlin-owned provider relationship.
11. We collapse internal DevStudio/company-plane authority into Berlin-owned account memberships + active account switching instead of keeping it distinct from the customer product shell.
12. A core account workflow (list accounts, create account, invite, accept invite, switch) is missing from the Berlin contract and gets recreated as Roma/Bob glue or direct Michael access.
13. Berlin starts making downstream product decisions instead of returning durable facts and normalized traits.
14. DevStudio is treated as a second customer product, a generic account browser, or a fake global superadmin shell instead of the explicit internal toolbench for Clickeen.
15. DevStudio implements account-browser/operator behavior using a parallel truth model instead of Berlin-owned canonical contracts and explicit internal tool routes.
16. `owner/admin/editor/viewer` semantics are left implicit or pushed entirely into entitlements instead of being defined as boring account-role meanings.
17. We introduce a customer-style DevStudio capability matrix before there is a real internal company-plane model that requires it.
18. `admin` and `owner` are collapsed into the same role meaning, or account deletion/ownership transfer are left available to non-owners.
19. `Linked Identity / Workspace Connection / Capability Scope State` are turned into a speculative multi-subsystem architecture instead of the simplest data shape that preserves the distinctions needed now.
20. A Berlin-owned cutover ships while dependent Roma/DevStudio/Bob/Michael/Paris/docs paths remain on the old model.
21. A legacy route, dual-read, dual-write, or fallback/back-compat shim is kept after a workflow has been moved to Berlin.
22. Account deletion or membership creation appears through a non-canonical route family outside Berlin.
23. Roma Team/member-detail creates account-local shadow profile data or edits another person's profile outside Berlin's canonical user-profile boundary.
24. `/api/roma/bootstrap` remains a live Paris-owned dependency for Roma or Bob after Berlin bootstrap has shipped.
25. `roma/lib/michael.ts` or `bob/lib/michael.ts` still provide live account-members/locales behavior for product surfaces after the relevant convergence phase.
26. A file listed in the concrete dependency map is silently left on the old model because the new Berlin path exists somewhere else.

---

## Simple final model

This PRD is done only when the account system can be explained in 5 lines:

1. Berlin authenticates the user.
2. Berlin owns the user profile, memberships, linked provider identities, and reusable provider/connector relationships for customer/product truth; internal DevStudio/company-plane authority remains separate.
3. Berlin resolves the active account, locale policy, entitlement snapshot, and normalized provider/account traits for the current account context.
4. Michael stores user/account/membership data only.
5. Roma renders account UI by calling Berlin, and Bob consumes the Berlin bootstrap snapshot and signed account capsule.

That is the boring architecture we are moving to.
