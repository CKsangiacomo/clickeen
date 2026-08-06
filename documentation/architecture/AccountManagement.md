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
| Tier/product policy | Roma/product policy, not Tokyo-worker. |
| Account files | Tokyo-worker stores exact account instance/page/asset files under the account root. |
| Public references | `accountPublicId + instanceId` or `accountPublicId + pageId`, depending on surface. |

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
| `accountPublicId` | The product/API/runtime field name for the compact `accounts.id` coordinate. | Berlin/Roma carry it from account truth; Tokyo-worker enforces it against account paths. |

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

Current runtime status: account deletion is disabled until that account-root operation exists. No service may return account deletion success after deleting only database rows or only storage objects.

Agency or multi-account behavior is not current customer account behavior and
does not belong in current account truth.

## Current Tables And Account Coordinates

Current account truth uses these relational tables/functions:

| Relational object | Operator meaning |
| --- | --- |
| `accounts(id,status,status_changed_at,tier,created_at)` | Account existence, status, tier, lifecycle timing. |
| `users(user_id,account_id,role,primary_email,login_provider,login_subject,first_name,last_name,primary_language,country,timezone,phone,whatsapp,created_at)` | One-account user, role, login mapping, accepted user fields. |
| `account_invitations(...)` | Account-scoped invitation lifecycle. |
| `resolve_login_identity` | Login identity resolution. |
| `accept_login_invitation_identity` | Invite acceptance plus user creation. |
| `transfer_account_owner` | Owner transfer operation. |

`accounts.id` is the compact account product/storage coordinate.
`accountPublicId` is the API/embed/authz field name for that same value.
Current Berlin/Roma payloads may carry both `accountId` and `accountPublicId`;
they must match.

Account runtime storage uses:

```text
accounts/{accountPublicId}/
```

Public widget references use:

```text
accountPublicId + instanceId
```

Page references use:

```text
accountPublicId + pageId
```

When page public serving is enabled, the public route shape is:

```text
/{accountPublicId}/pages/{pageId}
```

## User

The user row answers:

- who the human is;
- which one account they belong to;
- what role they have in that account;
- the accepted/current person fields shown in User Settings;
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
account-root deletion operation exists.

## Product Surfaces

### Roma

Roma is the authenticated product shell for the current account. It receives Berlin-issued user/account context and uses Tokyo product operations for widget instance work.

Roma does not own user/account truth and does not read Supabase tables directly for normal account truth.

Roma account routes are the product mutation boundary for account-scoped work.
They carry the current account coordinate to the owning service instead of
letting downstream systems rediscover account identity.

### Bob

Bob is the editor kernel. Bob consumes Berlin/Roma account context and Tokyo-owned widget instance state. Bob does not own account management.

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

Tokyo owns widget definitions, exact account instance/page storage operations,
translated locale overlay storage, and submitted public package
storage/readiness for widgets and pages. Tokyo consumes account/user authz
context; it does not decide billing or account identity, does not render widget
package bytes from saved source, does not compose pages, and does not own
translation generation.

### Public Serving

Public serving reads generated R2/CDN artifacts. It does not read authoring/account DB state.

## Verification

Verify account behavior through the owning authority:

| Concern | Verification owner |
| --- | --- |
| Auth/session/account bootstrap | Berlin/Roma session bootstrap response |
| Current account UI behavior | Roma authenticated account shell |
| Account instance/page files | Roma account routes plus Tokyo-worker storage evidence |
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
