# Account Management

STATUS: ACTIVE DB PIVOT MODEL

This file is the canonical account-management model for the active DB Pivot execution. Older PRD 064/065/066/067/068/072 account-management docs are historical snapshots only.

For product/system context, see [CONTEXT.md](./CONTEXT.md) and [Overview.md](./Overview.md).

## Hard Invariant

Clickeen V1 uses a deliberately boring account model:

```text
One user belongs to one account.
One account has many users.
The user's role is the user's role in that account.
```

There is no active V1 customer account switching model and no core many-to-many membership table.

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
| `Invite Members` | Account-scoped invitation lifecycle for creating another user in the same account. | Berlin V1 lifecycle table/route surface. |
| `Login Method` | A way to prove the human can sign into Clickeen, such as Google login. | Berlin login boundary. |
| `Account Connection` | Account-authorized external provider/source, such as a Google Business Profile connection for a reviews widget. | Future connector PRD, account-owned. |
| `Connection Resource` | A selectable external business/resource under an account connection. | Future connector PRD. |
| `Widget Source` | A widget instance reference to an account-owned connection resource. | Future connector/widget PRD. |

## Account

Account truth is intentionally small.

The account row answers:

- what account exists;
- current status and tier/billing state;
- when status last changed for grace/deletion workflows;
- when the account was created.

Account deletion is an operation, not a retained `closed` status. If an account is deleted, account DB rows and account-owned storage are cleaned up.

Agency later is account-to-account, not user-to-many-accounts:

```text
agency account manages client account
agency user belongs to agency account
client user belongs to client account
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

Invite Members is a real V1 feature.

Rules:

- invitations target one account, one email, and one intended role;
- invite creation checks whether that email already exists as a user;
- existing email rejects instead of attaching the user to the account;
- accepting an invitation creates or activates one user for the inviting account;
- no `account_members` row is created;
- removing a non-owner team member removes that user from the account model rather than creating an account-less or multi-account user.

Owner transfer survives as a V1 account operation, but it must be rewritten against `users.role`, not membership rows.

## Login And Connectors

Login is not connector authorization.

Google login answers:

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

When connectors are built, the user must explicitly authorize the account connection. Clickeen may suggest the same Google account used for login, but connector authorization remains a separate account-owned flow.

## Product Surfaces

### Roma

Roma is the authenticated product shell for the current account. It receives Berlin-issued user/account context and uses Tokyo product operations for widget instance work.

Roma does not own user/account truth and does not read Supabase tables directly for normal account truth.

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
- V1 Invite Members lifecycle until a later PRD moves it.

Berlin must not preserve old `user_profiles`, `account_members`, `active_account_id`, or connector-looking `linkedIdentities` output as product truth.

### Tokyo

Tokyo owns widget definitions, instance state operations, translated values, and public artifact materialization operations. Tokyo consumes account/user authz context; it does not decide billing or account identity.

### Public Serving

Public serving reads generated R2/CDN artifacts. It does not read authoring/account DB state.

## Deleted Active Concepts

These are not active product truth in the DB Pivot model:

- `Account Membership` as the core role authority;
- one user directly belonging to multiple accounts;
- `active_account_id`;
- account switching in customer Roma;
- `login_identities` as connector/provider state;
- provider profile snapshots as user truth;
- contact-verification tables as permanent user truth;
- `accountPublicId` as a second co-equal account identity in the new DB model.

## Execution References

Active execution references:

- `Execution_Pipeline_Docs/02-Executing/103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Pivot__EXEC__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Accounts__PRD__Accounts_Table.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Users__PRD__Users_Table.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Berlin_Auth_Connector__AUDIT__Users_Login_Connector_Map.md`
