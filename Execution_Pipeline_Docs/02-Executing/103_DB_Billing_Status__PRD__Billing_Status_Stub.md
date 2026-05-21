# PRD 103_DB Billing Status - PLG Billing Status Stub

Status: Planning child of active DB pivot
Owner: Berlin + Billing
Date: 2026-05-21
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: DB pivot execution that depends on `accounts.status`, PLG gates, publish gates, translation spend gates, and suspension behavior

## Purpose

Define the temporary billing/account-status contract Clickeen uses until real billing is active.

This PRD is a stub on purpose. It does not implement Stripe, invoices, plans, retries, or billing-provider webhooks. It defines the product contract that `accounts.status` must obey so Berlin, Roma, Tokyo, San Francisco, and public serving do not invent their own meanings.

## Product Why

`accounts.status` is one of the few hot account facts in Supabase.

If that value is vague, every service will improvise:

- Roma might allow edits while Tokyo blocks publish.
- Translation could spend model budget for an account that should be blocked.
- Public widgets could remain live after suspension because public serving reads R2/CDN only.
- A fake `closed` status could keep dead free accounts and artifacts around forever.

The goal is not to build billing now. The goal is to define the working status contract now so the DB pivot can execute safely and real billing can later replace the stub without changing product semantics.

## Product What

V1 approved account status values:

```text
active
past_due
suspended
```

No `closed` status exists in V1.

Closing/deleting an account is an account deletion operation. It removes the account row and owned operational/product/public artifacts according to the deletion policy. Clickeen must not keep closed free accounts in hot product tables as a hidden storage bill.

## Product How

Berlin owns `accounts.status`.

Until real billing is active:

- account creation writes `status = active`;
- admin/test controls may move an account to `past_due` or `suspended`;
- every status change appends a human-readable line to `accounts/{accountId}/account-history.jsonl`;
- current product behavior reads only `accounts.status`, never account history.

When real billing is activated:

- billing-provider events update `accounts.status` through Berlin;
- the same status values and operation gates remain unless a billing PRD explicitly changes them;
- billing history may receive a separate retention/audit model, but it must not overload the core `accounts` table.

## Operation Matrix

| Status | Roma login/session | Instance create/edit/save | Translation Generate | Publish | Unpublish | Public widget display |
| --- | --- | --- | --- | --- | --- | --- |
| `active` | allowed | allowed | allowed if `ck-policy` allows | allowed if `ck-policy` allows | allowed | displayed when published |
| `past_due` | allowed with billing recovery UI | allowed | blocked | blocked | allowed | displayed during recovery window |
| `suspended` | recovery/settings only | blocked | blocked | blocked | allowed | not displayed |

If a future status does not change product behavior in this matrix, it is not a core account status.

## Suspension And Public Widgets

Public serving must not read Supabase on visitor traffic.

That means suspension cannot work by asking the public embed route to check `accounts.status` on every page view. That would put the database back in the public hot path and undo the R2/CDN serving model.

Instead, suspension is a Berlin-triggered product operation:

1. Berlin changes `accounts.status` to `suspended`.
2. Berlin asks Tokyo to run account suspension materialization for that account.
3. Tokyo enumerates the account's published `instances` rows from Supabase.
4. Tokyo removes or disables the public R2/CDN artifacts for those instances.
5. Tokyo leaves authoring payloads intact unless this is account deletion.
6. Public visitor requests now fail or show the approved inactive/suspended widget response from static/public artifact state, without a Supabase read.

Unsuspension is the reverse product operation:

1. Berlin changes `accounts.status` from `suspended` to `active` or `past_due`.
2. If the account may display public widgets again, Berlin asks Tokyo to rematerialize previously published instances.
3. Tokyo writes public artifacts from Tokyo-owned instance payloads and marks live state according to the publish contract.

The important rule:

```text
Supabase owns the operational status.
Tokyo materializes the public serving result.
R2/CDN serves the result.
```

Public artifact presence is not account status truth. It is the materialized result of a named operation.

## Shared Product Invariant

The `accounts.status` constraint is not cross-service validation.

Berlin, Roma, Tokyo, San Francisco, and public serving are not separate companies negotiating untrusted payloads. They are one Clickeen system.

The database constraint exists because account status is shared Clickeen product vocabulary. The system must physically have only the approved status words so it does not accumulate accidental states from migrations, dashboard edits, scripts, tests, or agent-created vocabulary.

Minimum invariant required by the Accounts PRD:

```sql
create type account_status as enum ('active', 'past_due', 'suspended');
```

This is the SQL form of the product rule:

```text
Clickeen account status is active, past_due, or suspended. Nothing else exists.
```

This PRD does not add a billing table in V1.

Real billing may later add billing-provider tables, subscription tables, invoices, or event ingestion tables. Those are billing implementation details and must not be smuggled into core `accounts` without a billing PRD.

## Non-Goals

- No Stripe/real billing integration in this stub.
- No subscription table in this stub.
- No invoice table in this stub.
- No `closed` status.
- No public serving database read.
- No account-history DB table.
- No tier limits in account status.
- No duplication of `ck-policy`.

## Acceptance Criteria

- `accounts.status` uses only `active`, `past_due`, or `suspended`.
- The Accounts PRD points to this PRD for status semantics.
- The operation matrix is implemented by Berlin/Roma/Tokyo/San Francisco gates before DB pivot execution is marked green.
- `suspended` accounts do not display public widgets without adding a Supabase read to public visitor traffic.
- Suspension/unsuspension names the Tokyo materialization operation used to remove/restore public artifacts.
- Status changes append to account history JSONL and do not require `updated_at`, `status_changed_at`, or `tier_changed_at` columns.
- Real billing activation can replace the stub writer while keeping the same product gates.
