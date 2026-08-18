# Account Management

STATUS: CURRENT SYSTEM OPERATOR SPEC

This file is the current account-management model for Clickeen. It describes
current account truth and the account/storage coordinate rules used by Berlin,
Roma, Tokyo-worker, and product routes.

For product/system context, see [CONTEXT.md](./CONTEXT.md) and [Overview.md](./Overview.md).

## Operator Quick Reference

| Concern | Operator truth |
| --- | --- |
| Account authority | Berlin owns auth/user/account bootstrap truth. |
| Product account shell | Roma consumes Berlin context and operates the current account. |
| Account storage coordinate | `accounts.id`, exposed to product/API/runtime payloads as `accountPublicId`. |
| Account runtime root | `accounts/{accountPublicId}/`. |
| Role authority | `users.role` in the one-account user model. |
| Tier/product policy | System policy consumed through Roma; never Widget Core or Tokyo-worker. |
| Editable Widget access | Every tier may use every Widget and retain editable instances. |
| Public Widget capacity | `instances.published.max` at Roma Publish. Free is one served instance. Roma performs a fast local precheck; Tokyo-worker owns the final account-atomic transition. A live overlapping first Publish receives `409 PUBLISH_IN_PROGRESS`; a later request that finds the slot consumed receives the existing `402 UPGRADE_REQUIRED` result. |
| Widget denial context | Widget-owned complete localized template from `upsell/{locale}.json`. |
| Upsell surface and CTA | Roma composes one Popup from system plan truth, Widget context, and the system CTA; Dieter owns mechanics only. |
| Public package generation | Roma's one Widget-neutral materializer generates complete served HTML/CSS/JavaScript only on explicit allowed Publish. |
| Suspended-account lifecycle | Day 0-30 public-serving grace; day 30+ automatic free-tier serving materialization; day 90+ automatic account-root deletion if recovery has not occurred. The scheduled runner and complete delete operation remain implementation gaps. |
| Account files | Tokyo-worker stores exact account instance and asset files under the account root. |
| Public references | `accountPublicId + instanceId`. |

If an operator needs account truth, start at Berlin/Roma session bootstrap. If
an operator needs account files, start at the Roma account route and
Tokyo-worker account root. Do not derive account truth from public URLs, R2
object listings, widget config, or browser-local state.

## Hard Invariant

Clickeen uses a deliberately boring account model:

```text
One user belongs to one account.
One account has many users.
The user's role is the user's role in that account.
```

There is no current customer account switching model and no core many-to-many
membership table.

If someone tries to invite or add an email already associated with a user, Berlin rejects the operation:

```text
This user is already associated with an account.
```

That rejection is product behavior. The system must not silently attach the same user to a second account.

## Core Terms

| Term | Meaning | Owner |
| --- | --- | --- |
| `Account` | The business/customer boundary for billing, tier, product access, instances, and deletion cleanup. | Berlin/account DB model for account truth; Roma/Tokyo consume account context through product operations. |
| `User` | The human using Clickeen, including the one account they belong to and their role in that account. | Berlin owns user/auth truth. |
| `Role` | The user's permission level in their one account: `owner`, `admin`, `editor`, or `viewer`. | Stored on `users`, not on a membership row. |
| `Invite Members` | Account-scoped invitation lifecycle for creating another user in the same account. | Berlin current lifecycle table/route surface. |
| `Login Method` | The current human sign-in proof. Cloud-dev/current runtime uses Google login. | Berlin login boundary. |
| `accountPublicId` | The product/API/runtime field name for the compact `accounts.id` coordinate. | Berlin/Roma carry it from account truth; Tokyo-worker uses that trusted coordinate for internal operations and bounds untrusted public-route coordinates at public ingress. |

Connector terms are not current account-management primitives. Integration
account-connection terms must not be treated as account truth.

## Account

Account truth is intentionally small.

The account row answers:

- what account exists;
- current status and tier/billing state;
- when status last changed for grace/deletion workflows;
- when the account was created.

Account context must not derive product capabilities, account display metadata,
or slugs from the compact account id. Roma may display the compact account
coordinate as a coordinate label; that is not account display metadata.

Account deletion is an operation, not a retained `closed` status. If an account
is deleted, account DB rows and account-owned storage must be cleaned up by the
same account-root operation.

The settled suspended-account lifecycle uses `status_changed_at` as its one
clock:

1. day 0-30: existing published Widgets continue serving during billing
   recovery grace;
2. day 30+: the Berlin/Billing lifecycle runner invokes the named operation
   that materializes free-tier public serving for the account; and
3. day 90+: if recovery has not occurred, the runner invokes the complete
   account-root deletion operation.

This is account lifecycle, not Widget Publish, Save, or per-view serving work.
Current runtime status: the scheduled lifecycle runner and complete
account-root deletion operation are not implemented. Account deletion remains
disabled until that operation owns both database and account storage cleanup.
No service may return account deletion success after deleting only database
rows or only storage objects.

Agency or multi-account behavior is not current customer account behavior and
does not belong in current account truth.

## Current Tables And Account Coordinates

Current account truth uses these relational tables/functions:

| Relational object | Operator meaning |
| --- | --- |
| `accounts(id,status,status_changed_at,tier,created_at)` | Account existence, status, tier, lifecycle timing. |
| `users(user_id,account_id,role,primary_email,login_provider,login_subject,first_name,last_name,primary_language,use_primary_language_for_ui,country,timezone,phone,whatsapp,created_at)` | One-account user, role, login mapping, accepted user fields, and dormant person-scoped UI-language preference. |
| `account_invitations(...)` | Account-scoped invitation lifecycle. |
| `resolve_login_identity` | Login identity resolution. |
| `accept_login_invitation_identity` | Invite acceptance plus user creation. |
| `transfer_account_owner` | Owner transfer operation. |

`accounts.id` is the compact account product/storage coordinate.
`accountPublicId` is the API/embed/authz field name for that same value.
Current Berlin/Roma payloads may carry both `accountId` and `accountPublicId`.
Berlin owns that account truth; once its authority proof has been accepted at
the untrusted transport boundary, downstream Clickeen services use the issued
coordinate without independently comparing or rediscovering account identity.

Account runtime storage uses:

```text
accounts/{accountPublicId}/
```

Public widget references use:

```text
accountPublicId + instanceId
```

## User

The user row answers:

- who the human is;
- which one account they belong to;
- what role they have in that account;
- the accepted/current person fields shown in User Settings;
- whether future product UI may use the person's primary language
  (`use_primary_language_for_ui`, default `false`; no current UI/runtime
  consumer);
- the minimum login mapping needed by the active sign-in flow.

The user row must not contain:

- account switching state;
- connector tokens/scopes/resources;
- Google Business Profile ids;
- Instagram/Facebook page ids;
- widget source references;
- duplicate `_verified` flags next to accepted/current email/phone values.

## Roles

| Role | Meaning |
| --- | --- |
| `viewer` | Can view account surfaces allowed to viewers. |
| `editor` | Viewer + edit/create product content where tier allows. |
| `admin` | Editor + normal account/team operations where tier allows. |
| `owner` | Admin + final accountable holder of the account. |

Effective capability is:

```text
user role + account tier/status/policy
```

Roles do not replace billing/tier policy. Billing/tier policy does not redefine role meaning.

## Invite Members

Invite Members is a real current feature.

Rules:

- invitations target one account, one email, and one intended role;
- invite creation checks whether that email already exists as a user;
- existing email rejects instead of attaching the user to the account;
- accepting an invitation happens during login and creates one user for the inviting account in the same transaction that marks the invitation accepted;
- no `account_members` row is created;
- removing a non-owner team member removes that user from the account model rather than creating an account-less or multi-account user.

Owner transfer is a current account operation and must operate against
`users.role`, not membership rows.

## Login And Connectors

Login is not connector authorization.

Current runtime login is Google. Google login answers:

```text
Which Clickeen user does this verified Google login belong to?
```

It does not create:

- Google Business Profile access;
- Google Reviews access;
- Instagram/Meta access;
- connector scopes;
- widget sources;
- reusable provider tokens for widgets.

Connector authorization is not a current account-management primitive.

## Authz Capsule

Berlin bootstrap/Roma account routes carry the account authority in an authz
capsule. Current capsule payload fields are:

```text
accountId
accountPublicId
accountStatus
accountWebsiteUrl
entitlements
profile
role
authzVersion
iat
exp
```

Roma verifies and refreshes the current-account capsule at account route
boundaries. Roma `/api/bootstrap` strips `authz.accountCapsule` from the JSON
response body and writes it as the account authz cookie.

The current `profile` and `entitlements` fields carry the exact tier keys and
values used by the shared upsell surface. Roma formats the current profile and
selects the first higher tier whose system entitlement satisfies the denied
Boolean/numeric `required` demand. Widgets and Bob do not name or select a
commercial plan.

## Operator Routes

| Product operation | Roma route | Berlin backing route | Owner |
| --- | --- | --- | --- |
| Bootstrap current account | `/api/bootstrap` | `GET /session/bootstrap` | Berlin/Roma |
| Current user/account view | `/api/me` | `/me` | Berlin/Roma |
| Team members | `/api/account/team/**` | `/accounts/:id/members` | Berlin |
| Team invitations | `/api/account/team/invitations/**` | `/accounts/:id/invitations` | Berlin |
| Login-time invitation acceptance | login callback flow | `POST /invitations/:token/accept` | Berlin |
| Owner transfer | `/api/account/owner-transfer` | `/accounts/:id/owner-transfer` | Berlin |
| Tier-drop dismissal | `/api/account/lifecycle/tier-drop/dismiss` | `/accounts/:id/lifecycle/tier-drop/dismiss` | Berlin |
| Account deletion | `DELETE /api/account` | `DELETE /accounts/:id` | Roma/Berlin, currently disabled |

Account deletion currently returns conflict. Roma `DELETE /api/account` and
Berlin `DELETE /accounts/:id` must not report deletion success until the full
account-root deletion operation exists. The same missing operation and
scheduled runner are the current implementation handoff for automatic day-90
cleanup; they are not a PRD 129 Publish/Serve blocker.

## Product Surfaces

### Roma

Roma is the authenticated product shell for the current account. It accepts the
Berlin authority proof at the browser-facing boundary, trusts the Berlin-issued
user/account context, and uses Tokyo product operations for Widget instance
work. Verifying an authority proof that crossed an untrusted transport is not a
license to revalidate Berlin's account semantics after acceptance.

Roma does not own user/account truth and does not read Supabase tables directly for normal account truth.

Roma account routes are the product mutation boundary for account-scoped work.
They carry the current account coordinate to the owning service instead of
letting downstream systems rediscover account identity.

Roma also owns assembly and hosting of the one shared account upsell surface.
For a Widget-semantic denial, it combines exact system current/target plan
truth, the complete localized contextual template supplied by that Widget, and
the system-owned CTA. Roma-native commands use system-owned context. Roma does
not place Widget-specific copy in route/UI branches, and it trusts a Bob draft
already admitted through Bob's exact editing boundary when Save is requested.

For account Widget instances, Create writes the initial editable source and
Save updates it. Bob returns one complete logical instance document containing its customized shared
Header/Stage/Pod/capability state and its Widget Core state. Roma resolves the
`instance.config.json` / `instance.content.json` source split. Only explicit
allowed Publish invokes the one generic Widget materializer. That
materializer—not Bob and not Tokyo-worker—generates the served complete
`index.html`, complete `styles.css`, and mandatory `runtime.js`.

For publication capacity, Roma first uses its exact current account policy and
published-instance facts as a fast precheck before materialization. It passes
the exact `instances.published.max` value with the generated package to
Tokyo-worker. Tokyo-worker then owns the final account-atomic first-Publish
transition through one Tokyo-owned Cloudflare
`AccountPublicationCoordinator` Durable Object selected deterministically from
`accountPublicId`.

The coordinator sets its transient `active` gate synchronously before its
first await. It then reads its reserved lifecycle-fence storage key before any
R2 work; it writes no coordinator record. That read gives the in-flight command
Cloudflare's Durable Object shutdown uniqueness behavior, so an old execution
is stopped rather than allowed to overlap a replacement object after a deploy
or runtime restart. The coordinator holds the gate only across the exact
published-count decision and package/serve-state commit, then clears it before
cache purge.

Publication truth remains each instance's `serve-state.json`; Durable Object
storage contains no tier, count, publication set, queue, or release registry.
Republish is allowed without consuming another slot. A contender while the
gate is active receives `409 PUBLISH_IN_PROGRESS` and persists no package or
publication state. A later request after the winner committed reads the new
published count and receives the existing `402 UPGRADE_REQUIRED` capacity
result when full. There is no polling loop, automatic retry, second publication
truth, or per-view capacity check.

### Bob

Bob is the editor kernel. Bob consumes Berlin/Roma account context and
Tokyo-owned Widget instance state as trusted system truth. Bob does not own
account management and does not narrow, repair, or revalidate those
authorities' output.

For a Widget-bound tier capability, Bob's one generic edit-operation boundary
uses the exact system policy and the compiled Widget binding before mutating
browser-memory state. A denied operation leaves the draft unchanged and carries
the capability/message identity to Roma. Bob does not resolve tiers, select a
target plan, author upsell copy, own a second Popup, or send the already-gated
draft through the same entitlement decision again at Save.

Current local implementation: Bob applies each Widget's compiled bindings at
one common operation boundary and sends Roma
`{ capability, messageId, required }` on denial. The draft remains unchanged,
Roma chooses the first qualifying higher tier and opens one shared Popup, and
Save does not repeat the decision. Every current Widget has its canonical
`upsell/{locale}.json` source locally.

### Berlin

Berlin owns:

- OAuth login start/callback;
- sign-in session issuance/refresh/logout;
- user creation/resolution;
- first-account provisioning;
- invitation acceptance;
- user/account bootstrap context;
- current Invite Members lifecycle.

Berlin must not preserve old `user_profiles`, `account_members`, `active_account_id`, or connector-looking `linkedIdentities` output as product truth.

### Tokyo

Tokyo owns widget definitions, exact account instance storage operations,
translated locale overlay storage, and submitted public widget package
storage/readiness. Tokyo consumes the accepted Roma account/user authority and
the exact submitted package; it does not re-prove account policy, decide billing
or account identity, reinterpret Widget semantics, or own translation
generation.

Tokyo-worker physically writes the canonical source documents from Roma's exact
semantic config/content payloads and stores Roma's exact package bytes under the
account instance folder. It never generates, compiles, renders, or modifies the
Widget package.

### Public Serving

Public serving resolves the untrusted public route coordinate, reads the exact
Tokyo-owned serve state and generated package, and returns only a published
instance. The stored base `index.html` already contains complete semantic base
content. For an explicit non-base locale, Tokyo-worker reads the exact trusted
overlay and applies it to the semantic HTML response before returning it;
client JavaScript is not required to discover the localized content.

Public serving does not revalidate the saved source, package fingerprint,
package shape, or Translation Agent output. It does not read relational account
DB state or call an agent or model on a visitor request.

### Local Public Runtime

The local public-serving path reads exact publication truth and exact stored
package bytes. It authors switcher options from the exact base locale and
stored overlay coordinates. For a selected non-base locale it applies every
present trusted stable-identity value to the materialized
`data-ck-content-path` body or exact `data-ck-content-attribute` target through
Cloudflare `HTMLRewriter`, then sets `<html lang>` before JavaScript. A newly
added identity remains intentional untranslated saved source until Generate;
a deleted identity has no current node. It does not compare package
fingerprints or validate the overlay against saved source in the public
request. The route coordinate, locale syntax, and publication gate remain real
external/product boundaries.

The all-Widget changes are deployed and verified in cloud-dev; owner QA remains
pending. Authenticated translation list/read/write operations also trust the
exact stored overlay coordinates and values; they do not project or compare
them against saved source.

## Verification

Verify account behavior through the owning authority:

| Concern | Verification owner |
| --- | --- |
| Auth/session/account bootstrap | Berlin/Roma session bootstrap response |
| Current account UI behavior | Roma authenticated account shell |
| Account instance files | Roma account routes plus Tokyo-worker storage evidence |
| Account assets | Roma `/api/account/assets` or Roma Assets UI |
| Account storage bytes | R2 evidence after `pnpm cf:preflight` |
| Supabase account schema changes | reviewed migration and Supabase migration workflow |

Do not verify account truth by inspecting only browser memory or public runtime
URLs. Public runtime proves serving, not account authority.

## Not Current Product Truth

These are not active product truth:

- `Account Membership` as the core role authority;
- one user directly belonging to multiple accounts;
- `active_account_id`;
- account switching in customer Roma;
- `login_identities` as connector/provider state;
- provider profile snapshots as user truth;
- contact-verification tables as permanent user truth;
- `accountPublicId` as a second co-equal account identity.

## Operator References

Current behavior is documented in:

- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/michael.md`
- `documentation/architecture/CONTEXT.md`
