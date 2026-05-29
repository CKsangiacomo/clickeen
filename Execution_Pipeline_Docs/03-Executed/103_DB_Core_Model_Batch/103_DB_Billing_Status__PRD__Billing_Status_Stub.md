# PRD 103_DB Billing Status - PLG Billing Status Stub

Status: Executed historical evidence / surviving doctrine extracted to PRD 105B; superseded by PRD 105, 105A, and 105B where conflicting
Owner: Berlin + Billing
Date: 2026-05-21
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: DB pivot execution that depends on `accounts.status`, PLG gates, publish gates, translation spend gates, billing recovery, and downgrade/delete behavior

Archive note: this document is no longer active execution authority. It is retained as evidence for the temporary PLG account-status contract.

## Purpose

Define the temporary billing/account-status contract Clickeen uses until real billing is active.

This PRD is a stub on purpose. It does not implement Stripe, invoices, plans, retries, or billing-provider webhooks. It defines the product contract that `accounts.status` must obey so Berlin, Roma, Tokyo, San Francisco, and public serving do not invent their own meanings.

## Product Why

`accounts.status` is one of the few hot account facts in Supabase.

If that value is vague, every service will improvise:

- Roma might allow edits while Tokyo blocks publish.
- Translation could spend model budget for an account that should be blocked.
- Public widgets could remain paid-tier live forever after billing failure because public serving reads R2/CDN only.
- A fake `closed` status could keep dead free accounts and artifacts around forever.

The goal is not to build billing now. The goal is to define the working status contract now so the DB pivot can execute safely and real billing can later replace the stub without changing product semantics.

## Product What

V1 approved account status values:

```text
active
suspended
```

No `closed` status exists in V1.

Closing/deleting an account is an account deletion operation. It removes the account row and owned operational/product/public artifacts according to the deletion policy. Clickeen must not keep closed free accounts in hot product tables as a hidden storage bill.

In this PRD, `suspended` means billing recovery/grace state. It does not mean the account is immediately dead, and it does not mean Clickeen immediately deletes the customer's work.

## Product How

Berlin owns `accounts.status`.

Until real billing is active:

- account creation writes `status = active` and `status_changed_at = now()`;
- admin/test controls may move an account to `suspended` and update `status_changed_at = now()`;
- every status change appends a human-readable line to `accounts/{accountId}/account-history.jsonl`;
- current product behavior reads `accounts.status` and `accounts.status_changed_at`, never account history.

When real billing is activated:

- billing-provider events update `accounts.status` through Berlin;
- every billing-provider status change updates `accounts.status_changed_at` in the same operation;
- the same status values and operation gates remain unless a billing PRD explicitly changes them;
- billing history may receive a separate retention/audit model, but it must not overload the core `accounts` table.

## Operation Matrix

| Status | Roma login/session | Instance create/edit/save | Translation Generate | Publish | Unpublish | Public widget display |
| --- | --- | --- | --- | --- | --- | --- |
| `active` | allowed | allowed | allowed if `ck-policy` allows | allowed if `ck-policy` allows | allowed | displayed when published |
| `suspended` day 0-30 | allowed with billing recovery UI | allowed only as free tier | allowed only as free tier | allowed only as free tier | allowed | existing published widgets continue serving normally |
| `suspended` day 31-90 | allowed with billing recovery UI | allowed only as free tier | allowed only as free tier | allowed only as free tier | allowed | serving is reduced to what free tier allows |
| deletion after 90 days | not applicable | not applicable | not applicable | not applicable | not applicable | account-owned data/artifacts are deleted |

If a future status does not change product behavior in this matrix, it is not a core account status.

## Billing Recovery Lifecycle

Billing failure does not instantly kill an account.

The intended high-level lifecycle is:

1. **Day 0:** account enters `suspended` and Berlin writes `status_changed_at`.
2. **Day 0:** Roma/account operations behave as free tier through `ck-policy`.
3. **Day 0-30:** already-published public widgets continue serving normally.
4. **After 30 days:** public serving is reduced to whatever the free tier allows.
5. **After 90 days without recovery:** account deletion runs and removes operational rows plus owned Tokyo/R2 data/artifacts according to the account deletion policy.

This preserves customer-facing websites during the recovery window without letting unpaid paid-tier state live forever.

The day-30 and day-90 checks are derived from `accounts.status = suspended` and `accounts.status_changed_at`. There is no separate deadline column in V1. `status_changed_at` is the product clock for the current status lifecycle.

## Suspended Accounts And Public Widgets

Public serving must not read Supabase on visitor traffic.

That means billing recovery cannot work by asking the public embed route to check `accounts.status` or billing deadlines on every page view. That would put the database back in the public hot path and undo the R2/CDN serving model.

Instead, billing recovery uses named materialization operations:

1. On day 0, Berlin changes `accounts.status` to `suspended` and writes `accounts.status_changed_at`.
2. Roma/Tokyo use `ck-policy` as if the account is free for authoring/product operations.
3. Existing public artifacts continue serving unchanged for 30 days.
4. After 30 days, Berlin/billing asks Tokyo to run `applyFreeTierServing` for that account.
5. Tokyo enumerates the account's published `instances` rows from Supabase.
6. Tokyo removes, disables, or leaves public R2/CDN artifacts according to the free-tier allowance.
7. Public visitor requests keep reading R2/CDN only.

Recovery is the reverse product operation:

1. Berlin changes `accounts.status` from `suspended` to `active` and resets `accounts.status_changed_at`.
2. Berlin/billing restores the paid `tier` if billing recovery warrants it.
3. Tokyo runs `restorePaidTierServing` and rematerializes public artifacts from Tokyo-owned instance payloads according to the restored tier and publish contract.

After 90 days with no recovery, Berlin/billing starts account deletion. Deletion is not a retained account status.

The important rule:

```text
Supabase owns the operational status.
Berlin owns the current status clock in `accounts.status_changed_at`.
Tokyo materializes the public serving result from account status/tier and policy.
R2/CDN serves the result.
```

Public artifact presence is not account status truth. It is the materialized result of a named operation.

## Shared Product Invariant

The `accounts.status` constraint is not cross-service validation.

Berlin, Roma, Tokyo, San Francisco, and public serving are not separate companies negotiating untrusted payloads. They are one Clickeen system.

The database constraint exists because account status is shared Clickeen product vocabulary. The system must physically have only the approved status words so it does not accumulate accidental states from migrations, dashboard edits, scripts, tests, or agent-created vocabulary.

Minimum invariant required by the Accounts PRD:

```sql
create type account_status as enum ('active', 'suspended');
```

This is the SQL form of the product rule:

```text
Clickeen account status is active or suspended. Nothing else exists in V1.
```

This PRD does not add a billing table in V1.

Real billing may later add billing-provider tables, subscription tables, invoices, or event ingestion tables. Those are billing implementation details and must not be smuggled into core `accounts` without a billing PRD.

## Lifecycle Runner

The billing-status stub needs one scheduled product owner so suspended accounts do not depend on manual cleanup.

Berlin/Billing owns the lifecycle runner. It queries `accounts` for `status = suspended` using `accounts.status_changed_at` and then calls Tokyo product operations:

- day 30+: call `applyFreeTierServing(accountId)` once public-serving grace has expired;
- day 90+: call `deleteAccount(accountId)` after the deletion window has expired and no recovery has occurred.

The runner must be idempotent. Retrying `applyFreeTierServing` must produce the same free-tier public serving result. Retrying `deleteAccount` must complete missing cleanup without recreating data or failing because one cleanup step already ran.

The runner must not read public R2 artifacts to decide status. It reads `accounts` and uses Tokyo operations to materialize or delete.

## Non-Goals

- No Stripe/real billing integration in this stub.
- No subscription table in this stub.
- No invoice table in this stub.
- No `closed` status.
- No public serving database read.
- No account-history DB table.
- No billing deadline columns in core `accounts` in this stub; deadlines derive from `status_changed_at`.
- No tier limits in account status.
- No duplication of `ck-policy`.

## Acceptance Criteria

- `accounts.status` uses only `active` or `suspended`.
- The Accounts PRD points to this PRD for status semantics.
- The operation matrix is implemented by Berlin/Roma/Tokyo/San Francisco gates before DB pivot execution is marked green.
- `suspended` accounts immediately behave as free tier in Roma/product operations.
- Existing public widgets continue serving normally for 30 days after suspension.
- After 30 days, Tokyo materializes public serving down to what the free tier allows.
- After 90 days without recovery, account deletion removes operational rows plus owned Tokyo/R2 data/artifacts according to deletion policy.
- No billing recovery behavior adds a Supabase read to public visitor traffic.
- Billing recovery and free-tier serving materialization use `applyFreeTierServing` and `restorePaidTierServing`.
- Status changes append to account history JSONL and update `accounts.status_changed_at`; no generic `updated_at`, `tier_changed_at`, or separate billing deadline columns are added.
- Real billing activation can replace the stub writer while keeping the same product gates.

## Decisions Needed Before Execution

- Confirm the exact 30-day public-serving grace and 90-day deletion windows.
- Define what the free tier allows after day 30: number of published/served instances, branding, locales, and any widget-type exceptions through `ck-policy`.
- Define the user-facing Roma copy and notifications for day 0, before day 30, after day 30, and before day 90 deletion.
- Define the exact cleanup order for `deleteAccount` across `accounts`, `users`, `account_invitations`, `instances`, Tokyo payloads, R2 artifacts, account assets, and account history.
