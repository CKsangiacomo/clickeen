# PRD 103_DB Users - One User Belongs To One Account

Status: Planning child of active DB pivot
Owner: Berlin
Date: 2026-05-21
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: DB pivot execution that depends on login, session bootstrap, user roles, invitations, and account-owned product access

## Purpose

Define the user table around the hard Clickeen product invariant:

```text
One user belongs to one account.
One account has many users.
The user's role is the user's role in that account.
```

There is no core many-to-many account membership model in V1.

If someone tries to invite or add an email that already belongs to another account, the operation fails:

```text
This user is already associated with an account.
```

That rejection is the product behavior. The system must not create account switching, shared users, or implicit cross-account memberships.

## Product Why

Clickeen is a PLG SaaS product where account ownership, billing, usage, instances, translation, publish state, and deletion must stay simple.

The product needs to answer:

- which account does this user belong to;
- what role does this user have in that account;
- what person/profile fields does User Settings show and edit;
- can this email be invited into this account or is it already associated elsewhere;
- which account context should Roma/Bob/Tokyo use after login.

The product does not need:

- account switching in the customer shell;
- one user belonging directly to many customer accounts;
- role in a separate membership table;
- `active_account_id`;
- shared-user deletion/privacy complexity;
- agency implemented as users directly joining many client accounts.

Agency later is account-to-account roll-up, not user-to-many-accounts.

## Product What

The V1 user domain approves exactly one core table:

`users`

One row per human Clickeen user.

| Column | Type | Writer | Reader | Use |
| --- | --- | --- | --- | --- |
| `user_id` | uuid | Berlin | Berlin, Roma through Berlin | Internal human id. Sessions/auth/bootstrap use it to know which Clickeen human is active. |
| `account_id` | text | Berlin | Berlin, Roma through Berlin, Tokyo through Berlin-issued context | The one account this user belongs to. Required. No user exists in product without an account. |
| `role` | `user_role` | Berlin | Berlin, Roma through Berlin, Tokyo through account authz context | User's role in their account: `owner`, `admin`, `editor`, or `viewer`. Since a user belongs to one account, role belongs on `users`. |
| `primary_email` | citext | Berlin | Berlin, Roma through Berlin | Current user email in Clickeen. Used by the current Berlin login/signup flow, team/user UI, invitation matching, product email, account recovery, and support lookup. Globally unique in V1. |
| `first_name` | text nullable | Berlin/User Settings | Berlin, Roma through Berlin | Optional person profile/display field. |
| `middle_name` | text nullable | Berlin/User Settings | Berlin, Roma through Berlin | Optional person profile/display field. |
| `last_name` | text nullable | Berlin/User Settings | Berlin, Roma through Berlin | Optional person profile/display field. |
| `primary_language` | text nullable | Berlin/User Settings | Berlin, Roma through Berlin | BCP 47 person preference for product/user communication. Not account locale policy. |
| `country` | char(2) nullable | Berlin/User Settings | Berlin, Roma through Berlin | ISO 3166-1 alpha-2 person country preference/profile field. Not account billing/legal address unless a later PRD says so. |
| `timezone` | text nullable | Berlin/User Settings | Berlin, Roma through Berlin | IANA person timezone. |
| `phone` | text nullable | Berlin/User Settings after verification flow | Berlin, Roma through Berlin | Accepted current E.164 phone number. If present, it is already accepted; no duplicate `_verified` flag. |
| `whatsapp` | text nullable | Berlin/User Settings after verification flow | Berlin, Roma through Berlin | Accepted current E.164 WhatsApp number. If present, it is already accepted; no duplicate `_verified` flag. |
| `created_at` | timestamptz | Berlin | Berlin/admin/debug/migration proof | Written once when the user row is created. |

Approved role values:

```text
owner
admin
editor
viewer
```

Required constraints:

```sql
primary key (user_id)
unique (primary_email)
not null (account_id)
not null (role)
```

The account reference must point to the surviving account id from the Accounts child PRD.

`role` must be a DB enum type, not open text:

```sql
create type user_role as enum ('owner', 'admin', 'editor', 'viewer');
```

Profile fields must use shared normalization before write:

- `primary_email`: `citext`, globally unique;
- `primary_language`: BCP 47 tag such as `en`, `en-US`, `it`;
- `country`: ISO 3166-1 alpha-2 uppercase code such as `US`, `IT`, `GB`;
- `timezone`: IANA timezone such as `America/New_York`, `Europe/Rome`;
- `phone` and `whatsapp`: E.164 number such as `+14155552671`.

Names stay plain text because human names must not be over-normalized.

## Product How

Berlin owns the `users` table.

Signup:

1. Berlin resolves or creates the user from login/auth.
2. Berlin creates the account if this is a new signup.
3. Berlin writes the first `users` row with `role = owner` and the created `account_id`.
4. Roma receives one account context. There is no account picker.

Invite/add user:

1. Berlin receives target account, invited email, and target role.
2. Berlin checks `users.primary_email`.
3. If the email already exists, Berlin rejects with "This user is already associated with an account."
4. If the email does not exist, Berlin can create/activate the user under the inviting account according to the invitation flow.

Role change:

1. Authorized account owner/admin changes another user row's `role`.
2. The row stays in the same `account_id`.
3. No membership row is created.

Delete account:

1. Account deletion deletes the account.
2. Account deletion deletes that account's users.
3. No shared-user preservation problem exists because users are not shared across accounts.

Roma receives user/account context from Berlin. Roma does not write users directly.

Tokyo does not own users. Tokyo receives Berlin-issued account/user authorization context for product operations.

San Francisco does not touch users.

## Provider, Login, And Connector Boundary

Do not collapse these concepts:

- `User` = the human and person preferences in `users`.
- `Login Method` = how the human proves they are this user.
- `Account Connection` = account-level provider/source authorization that widgets can use.
- `Capability / scope state` = what that provider relationship is currently allowed to do.
- `Connection Resource` = selectable external source under an account connection, such as a Google Business Profile location or Instagram page.
- `Widget Source` = the widget instance's reference to a connection resource.

Example:

```text
Pietro logs in with Google
```

That is a `Login Method`.

```text
Pietro's account connects Google Business Profile to power a Google Reviews widget
```

That is an `Account Connection`, not a user profile column.

Rules:

- `users` does not store provider ids, provider subjects, OAuth tokens, raw OAuth payloads, Google Business Profile ids, Instagram ids, or connector scopes.
- Social login may start a durable provider relationship, but the DB pivot must not bless the current Berlin provider tables until the auth/connector audit proves the surviving shape.
- Widgets must reference account-owned connection resources through the future connector/product boundary, not user login rows.
- Provider tokens and raw payloads stay behind the owning auth/connector boundary, never inside widget instances or user profile columns.

### First Account Creation With Google Login

Google login may create the first Clickeen account.

Flow:

1. User clicks Continue with Google.
2. Berlin completes Google OAuth/OIDC login.
3. Berlin receives the Google subject, email, and available name fields.
4. Berlin checks `users.primary_email`.
5. If the email already exists, Berlin logs the user into that user's existing account.
6. If the email does not exist, Berlin creates:
   - one account;
   - one user attached to that account with `role = owner`;
   - one `Login Method` record in the auth boundary, if that auth boundary survives the audit.
7. Roma receives one account context.

Google login does not create a Google Business Profile connection, Google Reviews source, Instagram source, or any widget connector.

### Login Can Suggest, Connector Must Authorize

If a user later creates a widget that needs an external provider, the connector flow must ask for explicit connector authorization.

Example for Google Reviews:

```text
Pietro signed in with Google.
Pietro creates a Google Reviews widget.
Clickeen may ask: "Use the Google account you signed in with? pietro@gmail.com"
Pietro must still authorize Google Business Profile scopes.
```

The user can choose:

- continue with the same Google account used for login;
- use a different Google account for the account connection.

Rules:

- Login can suggest.
- Connector must authorize.
- Login scopes are not connector scopes.
- A login method is not automatically an account connection.
- An account connection is not automatically a login method.
- The account connection belongs to the Clickeen account, not to the user session that created it.
- Widgets depend on account-owned connection resources, not on the user who happened to connect or log in.

Same pattern for Meta/Facebook/Instagram/X:

```text
Meta login proves the human.
Meta/Instagram connector authorization grants the Clickeen account access to external resources.
Instagram Feed widget references an account-owned resource.
```

## Berlin Auth And Connector Audit Requirement

Before implementation, the DB pivot must audit and decide what happens to the current Berlin auth/profile/contact/provider tables:

- `user_profiles`;
- `login_identities`;
- `user_contact_methods`;
- `user_contact_verifications`;
- any `active_account_id` or equivalent preference field;
- any provider email/name/avatar/profile snapshot columns;
- any current or planned connector/account connection persistence.

The audit must answer, with code and documentation evidence:

- what maps an external login to `users.user_id`;
- whether the current provider mapping is login-only, connector-capable, or mixed;
- what becomes person-level Login Method;
- what becomes account-level Account Connection;
- what becomes temporary verification flow state;
- which current tables are deleted, merged, or deferred into a separate auth/connector PRD.

This PRD does not approve extra auth, connector, or verification tables by default.

## Operational And Cost Efficiency

This model deletes the many-to-many user/account complexity before it reaches product code.

Operational wins:

- one row answers user, account, and role for normal product access;
- no customer account switching state;
- no `active_account_id`;
- no account-membership join for every Roma/Tokyo operation;
- invite/add-user failure is deterministic when email already exists;
- account deletion can delete account users without shared-user retention logic.

Cost wins at scale:

- one tiny account-scoped row per user;
- no membership table fan-out;
- no profile/provider churn on every login;
- no contact-verification flow state kept as permanent hot DB state;
- no public/embed traffic reads `users`.

Hot queries stay narrow:

```sql
select * from users where user_id = $1;
select * from users where account_id = $1 order by created_at asc;
select user_id from users where primary_email = $1;
```

The system must not:

- add `account_members` as core truth;
- add `active_account_id`;
- allow a user row to be associated with more than one account;
- silently merge or attach an existing email into another account;
- store connector/provider payloads on `users`;
- add `_verified` duplicates next to accepted phone/email fields.

## User Profile Fields

The approved V1 profile fields are deliberately boring:

- `first_name`;
- `middle_name`;
- `last_name`;
- `primary_language`;
- `country`;
- `timezone`;
- `phone`;
- `whatsapp`.

Name fields are optional display/profile fields, not legal-name truth and not required for product access. The product must support empty names, single names, and non-US naming patterns. Future legal/billing names require a separate account/billing/legal model.

`primary_language`, `country`, `timezone`, `phone`, and `whatsapp` are not arbitrary strings. They must use the normalized standards named in the table above.

`phone` and `whatsapp` are accepted/current values only. Pending values and verification challenges are temporary flow state outside `users`.

`primary_email` is also accepted/current user truth. Do not add `email_verified` unless a later PRD proves a real product state where an unverified email is stored as current profile truth.

Address is not approved in this PRD. If address is needed, the PRD must first decide whether it is person address, account/business address, billing address, tax/legal address, or shipping address.

## Agency Boundary

Agency does not make a user belong to many accounts.

Agency is account-to-account:

```text
agency account manages client account
agency user belongs to agency account
client user belongs to client account
```

If agency needs access to client account data later, it must be modeled as an account roll-up/managed-account relationship, not by adding agency users directly to every client account.

## Invitation Boundary

Invitation is account-scoped user creation/access.

Rules:

- invitations target an email and intended role for one account;
- accepting an invitation creates or activates a user under that account only if the email is not already associated with another account;
- if the email already exists in `users.primary_email`, the invite/add flow rejects with "This user is already associated with an account.";
- invitations do not create cross-account membership.

## Migration

Migration source for the approved `users` table:

- current `user_profiles.user_id` becomes `users.user_id` if it is the real human id;
- current account association comes from the current account/member/provisioning truth and becomes `users.account_id`;
- current role comes from the user's current account role and becomes `users.role`;
- current `user_profiles.primary_email` becomes `users.primary_email` if it is the real current primary email;
- current `given_name` maps to `first_name` only if it is semantically first name;
- current `family_name` maps to `last_name`;
- current `primary_language`, `country`, and `timezone` migrate if valid;
- accepted phone/WhatsApp values migrate only if they are already verified/accepted values, with no `_verified` column;
- `created_at` comes from current profile/user creation timestamp when reliable, otherwise migration time.

Delete/remodel candidates:

- `account_members` as core account/user role truth;
- `user_profiles` as separate core profile soup;
- `login_identities` unless the auth/connector audit proves a surviving linked-identity table is required;
- `user_contact_methods`;
- `user_contact_verifications`;
- `active_account_id`;
- provider metadata/profile snapshot columns.

Migration must fail and require product decision if the current data contains one user attached to multiple accounts. It must not silently pick one.

## Non-Goals

- No account switching in this PRD.
- No many-to-many membership table in this PRD.
- No login identity table approved in this PRD.
- No connector/account connection table approved in this PRD.
- No contact verification table approved in this PRD.
- No `active_account_id`.
- No provider profile snapshot storage in `users`.
- No address field until the product meaning is decided.
- No user history table or user history storage artifact in this PRD.

## Red Flags That Block Execution

The Users slice is not green if implementation preserves any of these shapes as core truth:

- `account_members` remains the account/user role authority;
- one user can belong to multiple accounts;
- invite/add user attaches an existing email to a second account;
- `active_account_id` remains on user/profile rows;
- role is stored outside the user row for normal customer accounts;
- contact methods or verification challenges survive without a separate product PRD;
- provider connector payloads are stored on user rows;
- Berlin writes provider profile metadata on every login just because a provider returned it;
- Roma or Tokyo writes users directly instead of receiving Berlin-owned user/account context.

## Acceptance Criteria

- `users` target schema includes `user_id`, `account_id`, `role`, `primary_email`, `first_name`, `middle_name`, `last_name`, `primary_language`, `country`, `timezone`, `phone`, `whatsapp`, and `created_at`.
- `users.primary_email` is globally unique.
- `users.primary_email` uses `citext`.
- `users.account_id` is required.
- `users.role` is required and uses `user_role`.
- `primary_language`, `country`, `timezone`, `phone`, and `whatsapp` are normalized to BCP 47, ISO 3166-1 alpha-2, IANA timezone, and E.164 standards as applicable.
- Signup creates account plus first user with `role = owner`.
- Invite/add user rejects an email already present in `users.primary_email` with "This user is already associated with an account."
- No core `account_members` table survives.
- No `active_account_id` survives.
- No `_verified` duplicates exist for email, phone, or WhatsApp.
- Berlin auth/connector audit explicitly decides the fate of `login_identities`, provider mapping, contact-method tables, connector/account connection state, and profile snapshots before implementation.
- Roma receives user/account context from Berlin and does not write users.
- Tokyo and San Francisco do not touch users.

## Verification

Required before this child PRD is green:

- schema migration plan maps existing user/account/role data into the target `users` row;
- migration proof rejects or surfaces any current user with multiple account memberships;
- Berlin signup tests prove first user is created as account owner;
- Berlin invite/add tests prove existing email is rejected;
- Berlin bootstrap tests prove account id and role resolve from `users`;
- auth/connector audit proves where external login to `users.user_id` mapping lives before any extra auth/connector table is approved;
- grep guard proves `account_members`, `active_account_id`, provider connector payloads on users, `_verified` columns, and role-outside-user are not reintroduced in core user model;
- `git diff --check`;
- relevant lint/typecheck/test commands recorded in the execution ledger.
