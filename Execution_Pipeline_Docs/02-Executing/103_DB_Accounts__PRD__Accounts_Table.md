# PRD 103_DB Accounts - One Account Identity And Core Account State

Status: Planning child of active DB pivot
Owner: Berlin
Date: 2026-05-21
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: DB pivot execution that depends on account identity, account status, account tier, user account association, invitations, and account-scoped instance ownership

## Purpose

Simplify account truth to one account identity and a tiny core account table.

Clickeen must stop carrying two account identities through the product. The target model has one account id:

```text
accounts.id = A1B2C3D4
```

That same id is used by Berlin, Roma, Tokyo, Supabase relationships, Tokyo folders, R2 paths, and public/embed paths:

```text
accounts/A1B2C3D4/instances/{instanceId}/...
```

There is no separate `public_id` in the target account model.

## Product Why

The current system has two account identities:

- private UUID `accounts.id`;
- compact `accounts.public_id` used by Tokyo/R2/product paths.

That split already causes code to call different values `accountId`. It makes service boundaries ambiguous and gives agents/developers a recurring chance to pass the wrong id.

The product does not need two live account identities. It needs one account id that is safe to use across product operations and public paths.

The account table must also stay small. It should not become a profile table, settings table, locale policy table, agency model, internal-platform flag, or duplicate policy engine.

## Product What

An account is the tenant/commercial container.

It answers only:

- what is the account id;
- what is the account lifecycle/billing status;
- what tier/profile feeds `ck-policy`;
- when the account was created;
- deletion is an operation, not a long-lived account status.

Users belong directly to one account and carry their account role on the `users` row. Invitations are account-scoped lifecycle state. Instances are Tokyo-owned account objects. Agency is a later account-to-account roll-up relationship. Detailed limits are resolved by `ck-policy`.

## Product How

Berlin owns account rows.

Berlin creates accounts, updates `status`, updates `tier`, and exposes account context to Roma.

Roma does not mutate accounts directly. Roma receives current account context from Berlin and calls Tokyo with the same account id for instance operations.

Tokyo does not create arbitrary accounts. Tokyo trusts Berlin-issued account context and uses the same account id for instance rows and R2/public artifact paths.

San Francisco does not touch accounts.

## Table

`accounts`

One row per Clickeen account.

| Column | Type | Writer | Reader | Use |
| --- | --- | --- | --- | --- |
| `id` | text | Berlin | Berlin, Roma through Berlin, Tokyo through Berlin-issued context | The one account identity. Same value as Tokyo account folder segment: `accounts/{accountId}/instances/...`. No `public_id` in target model. |
| `status` | `account_status` | Berlin | Berlin, Roma through Berlin, Tokyo through product context | Account lifecycle/billing state. Gates whether account-owned operations may proceed. |
| `status_changed_at` | timestamptz | Berlin | Berlin, Roma through Berlin, Tokyo/billing operations through product context | Timestamp when the current `status` value began. Used to run the suspended-account 30-day public-serving grace and 90-day deletion lifecycle. Updated only when `status` changes. |
| `tier` | `account_tier` | Berlin | Berlin, Roma, Tokyo through `ck-policy` input | Existing policy profile input: `free`, `tier1`, `tier2`, `tier3`. `ck-policy` resolves limits/capabilities from it. |
| `created_at` | timestamptz | Berlin | Berlin/admin/debug | Account creation timestamp. Written once. |

Approved values:

- `account_tier`: `free`, `tier1`, `tier2`, `tier3`
- `account_status`: values and behavior are defined by `103_DB_Billing_Status__PRD__Billing_Status_Stub.md` until real billing owns the same contract.

`status` and `tier` must not be open text. They are shared Clickeen product vocabularies and must be represented by DB enum types owned by the migration.

```sql
create type account_status as enum ('active', 'suspended');
create type account_tier as enum ('free', 'tier1', 'tier2', 'tier3');
```

No other `accounts` columns are approved in V1.

There is no generic `updated_at` in V1. Account change history is written as a cold account-owned history artifact, not hot DB columns.

`status_changed_at` is the one approved lifecycle clock because current product behavior depends on the age of the current status. It is not account history, and it is not a substitute for account history.

Required V1 account index:

```sql
create index accounts_suspended_status_changed_idx
  on accounts (status_changed_at, id)
  where status = 'suspended';
```

This supports the billing lifecycle runner that finds suspended accounts needing day-30 `applyFreeTierServing` or day-90 `deleteAccount` without scanning active accounts.

## Status Semantics

`status` is not abstract app state.

It must decide account operation gates. The Accounts execution slice must define the exact allowed status values and operation matrix before migration.

The temporary V1 status contract lives in `103_DB_Billing_Status__PRD__Billing_Status_Stub.md`. Accounts owns the `status` column; the billing-status PRD owns what each value means for product behavior until real billing is activated.

`status_changed_at` belongs to the same contract. It records when the current status started so billing recovery can answer:

- has this account been suspended long enough to reduce public serving to free-tier allowance;
- has this account been suspended long enough to delete account-owned data/artifacts;
- did recovery reset the lifecycle by moving the account back to `active`.

Any status write must update `status_changed_at` in the same Berlin-owned operation.

For PLG, `closed` is not an account status. If an account is deleted/closed, the system deletes the account row and owned data/artifacts according to the deletion policy. Keeping closed free accounts as rows plus storage creates avoidable storage cost and operational clutter.

V1 status set:

```text
active
suspended
```

Status names are locked for this stub. A future real-billing PRD may change them only by migration and product review.

Required matrix:

| Operation family | Status behavior required |
| --- | --- |
| Login/session bootstrap | Which statuses can enter Roma. |
| Instance create/edit/save | Which statuses can mutate account-owned instances. |
| Translation Generate | Which statuses can spend translation work. |
| Publish/unpublish | Which statuses can change product publish state. |
| Public embed serving | Which statuses keep already-published artifacts live. |

If a proposed status does not change one of those behaviors, it is not a core account status.

Account deletion must define:

- deletion trigger/owner;
- which DB rows are removed;
- which Tokyo-owned payloads/artifacts/assets are removed;
- whether any legal/billing retention record survives outside operational product tables.

## Account History

Account history is not hot operational state.

The product does not list, filter, join, or gate current behavior from historical tier/status changes. Current behavior comes from `accounts.status`, `accounts.status_changed_at`, and `accounts.tier`.

For account history, Berlin appends human-readable JSON lines to an account-owned cold artifact:

```text
accounts/{accountId}/account-history.jsonl
```

Example:

```json
{"at":"2026-05-21T10:00:00Z","event":"tier_changed","from":"free","to":"tier3","actor":"billing"}
{"at":"2026-07-01T09:00:00Z","event":"tier_changed","from":"tier3","to":"tier1","actor":"billing"}
{"at":"2026-07-14T08:00:00Z","event":"status_changed","from":"active","to":"suspended","actor":"billing"}
```

Rules:

- account history is not product truth;
- account history does not gate access, translation, publish, or billing behavior;
- current suspended-account grace behavior reads `accounts.status_changed_at`, not account history;
- Roma/Tokyo must not read it for current account decisions;
- it is read whole only when support/admin/history inspection needs it;
- it is deleted with the account unless legal/billing retention policy explicitly extracts a separate record;
- no `account_events` table in V1;
- no account history columns such as `tier_changed_from`, `tier_changed_to`, or `tier_drop_email_sent_at` in core `accounts`.

## Tier Semantics

`tier` is the existing policy profile input.

The account row stores only the tier. It does not store limits.

`ck-policy` survives only if it is the single entitlement resolver. The DB pivot must not replace it with account columns or scattered hardcoded tier checks.

`ck-policy` owns answers such as:

- max instances;
- max published/served instances;
- translation allowance;
- available locales;
- model profile;
- branding/feature gates.

The Accounts table must not duplicate those limits as columns.

World-class bar for `ck-policy` in this pivot:

- deterministic and side-effect free;
- typed inputs and outputs;
- one place to map `tier` plus role/operation context to capabilities;
- covered by tests for every tier;
- consumed consistently by Berlin/Roma/Tokyo;
- no service hardcodes tier limits outside it;
- no account columns duplicate its limits.

If current `ck-policy` fails that bar, the DB pivot must fix or rewrite it. The fallback is not to spread policy into tables and route code.

Locale split:

- number of locales available comes from `tier` through `ck-policy`;
- which locales the account chooses to use is a Roma account setting, not a core `accounts` column.

If selected locale settings are required, they need a separate explicit settings PRD/table with reader, writer, lifecycle, and cost behavior. They must not be placed in core `accounts`.

## User And Invitation Boundary

`account_members` does not survive as core truth.

The Users child PRD owns the user/account association:

```sql
users.account_id -> accounts.id
users.role
```

One user belongs to one account. A user's role is the user's role in that account.

Invite Members is an active product feature. `account_invitations` is approved as the V1 account-scoped invitation lifecycle table.

`account_invitations` owns only invitation lifecycle state:

| Column | Type | Writer | Reader | Use |
| --- | --- | --- | --- | --- |
| `id` | uuid | Berlin | Berlin/Roma through Berlin | Invitation id. |
| `account_id` | text | Berlin | Berlin | Target account. References `accounts.id`. |
| `email` | citext | Berlin | Berlin | Invited email. Used for pending invite display and accept/reject matching. |
| `role` | `user_role` | Berlin | Berlin/Roma through Berlin | Intended role for the user created by accepting the invitation. |
| `status` | `invitation_status` | Berlin | Berlin/Roma through Berlin | Invitation lifecycle: `pending`, `accepted`, or `revoked`. |
| `created_at` | timestamptz | Berlin | Berlin/Roma through Berlin | Invitation creation timestamp. |
| `expires_at` | timestamptz | Berlin | Berlin/Roma through Berlin | Pending invitation expiry timestamp. Pending invites must not live forever. |
| `accepted_at` | timestamptz nullable | Berlin | Berlin/Roma through Berlin | Set when invitation is accepted. |
| `revoked_at` | timestamptz nullable | Berlin | Berlin/Roma through Berlin | Set when invitation is revoked. |

`invitation_status` is a closed DB enum:

```sql
create type invitation_status as enum ('pending', 'accepted', 'revoked');
```

Invitation/add-user must reject an email that already exists in `users.primary_email`:

```text
This user is already associated with an account.
```

Invitations must not create many-to-many memberships or account switching.

Invitation indexes:

```sql
create index account_invitations_account_status_created_idx on account_invitations (account_id, status, created_at, id);
create index account_invitations_email_status_idx on account_invitations (email, status);
```

Invitation creation and acceptance must be transactional. The flow must not check `users.primary_email` in one request and write an invitation/user in a later unguarded request. Accepted/revoked invitations are retained only for the support/UI window named by the implementation slice, then deleted or moved into cold account-owned history if the product requires a record.

## Agency Extension Point

Agency is not a column on `accounts`.

When agency is supported, it must be modeled in a future agency PRD as an account-to-account roll-up relationship. This PRD deliberately does not approve agency tables, DDL, columns, or migrations.

The product rule to preserve for that future PRD: each child account remains a normal account with its own `id`, `status`, and `tier` unless `ck-policy` explicitly resolves inherited agency behavior.

Agency users belong to the agency account. Client users belong to their client account. Agency must not be implemented by adding agency users directly to every client account.

Do not add `account_type`, `is_agency`, `agency_id`, `parent_id`, or `managed_by` to `accounts` in v1.

## Migration

Current migration source:

- old `accounts.public_id` becomes target `accounts.id`;
- old UUID `accounts.id` becomes migration legacy and must not survive as product identity;
- users and surviving account-owned tables are rewritten to reference the compact account id;
- Tokyo/R2 paths already use the compact id and become aligned with DB identity.

Migration must produce one canonical account id per account. It must not preserve UUID and compact id as co-equal product identities.

## Deletion Targets

Delete or remove from active product model:

- `public_id`;
- UUID account id as product identity;
- `is_platform`;
- `name`;
- `slug`;
- `website_url`;
- `l10n_locales`;
- `l10n_policy`;
- tier-change notice columns from core `accounts`;
- publish booleans or vague containment flags on `accounts`;
- `account_members` as core user/account role truth;
- any service payload that uses ambiguous `accountId` for two different account id shapes.

If any removed field is still a real product need, it must move to a separate explicit PRD/model with a named reader, writer, lifecycle, and product behavior. It must not remain in core `accounts` by inertia.

## Non-Goals

- No account profile table in this PRD.
- No agency implementation in this PRD.
- No agency table or agency DDL in this PRD.
- No locale settings model in this PRD.
- No policy rewrite in this PRD.
- No billing provider integration rewrite in this PRD.
- No public/private dual id model.
- No internal/platform bypass flag.

## Acceptance Criteria

- `accounts` target schema has only `id`, `status`, `status_changed_at`, `tier`, and `created_at`.
- `status` excludes `closed`; account deletion is an operation with cleanup, not a retained account state.
- Account id is the compact id used by Tokyo folders and public paths.
- `public_id` does not survive as a target column.
- `is_platform` does not survive as a target column.
- `users.account_id` and surviving account-owned tables reference `accounts.id`.
- `account_members` does not survive as core user/account/role truth.
- `account_invitations` is the approved V1 Invite Members lifecycle table and does not create account membership.
- Invite/add-user rejects an existing `users.primary_email` instead of attaching that user to a second account.
- Roma/Tokyo product operations receive one account id shape.
- `ck-policy` receives `tier` as input and remains the source of entitlement decisions.
- `ck-policy` is either proven deterministic/typed/tested/consistently consumed or explicitly scheduled for repair before product execution resumes.
- No limits/counters/localization policies are duplicated into `accounts`.
- Locale availability comes from `ck-policy`; selected locales, if product-required, are deferred to a separate settings model.
- Account tier/status history is written to `accounts/{accountId}/account-history.jsonl`, not a DB table or history columns; current suspended-account lifecycle reads `status_changed_at`.
- Agency is documented only as a future account-to-account roll-up concept, not as core account columns, tables, or DDL.

## Rollback And Recovery

Pre-GA rollback is forward repair, not compatibility mode.

Before migration, export the current account/user/account-owned table state needed to rebuild the target rows. If validation finds ambiguous account ids, multi-account users, or missing compact ids, abort before writes. If a post-migration defect is found, repair by replaying the approved migration from the export into the target schema or by applying a corrective migration. Do not reintroduce dual account ids or `public_id` fallback code.

## Verification

Required before this child PRD is green:

- schema migration plan maps old UUID id to compact id without losing current accounts;
- user/account migration plan is reviewed for `users`, `account_invitations`, and any surviving account-owned tables;
- migration proof rejects or surfaces any current user associated with multiple accounts;
- Berlin bootstrap/account routes return one account id shape;
- Roma no longer has to distinguish `accountId` from `accountPublicId`;
- Tokyo account folder paths use the same `accounts.id`;
- grep guard proves `public_id` and `is_platform` are not reintroduced in the target account model;
- tests prove UUID-shaped account ids are rejected at Tokyo/public path boundaries;
- `git diff --check`;
- relevant lint/typecheck/test commands recorded in the execution ledger.
