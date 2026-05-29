# PRD 103_DB Current Supabase Inventory - Remote DB Audit Gate

Status: Executed historical evidence / audit gate completed for DB Pivot foundation
Owner: Product + Architecture + Berlin/Tokyo Engineering
Date: 2026-05-22
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: All DB Pivot implementation slices and all PRD 103 product execution

Archive note: this audit gate is no longer active execution authority. Its useful doctrine is extracted to `../02-Executing/105A__PRD__DB_R2_Operation_Authority.md`; PRD 105/105A supersede this document where storage or artifact language conflicts.

## Purpose

Stop making database decisions from partial visibility.

Before Clickeen writes any DB Pivot migration, deletes any table, reshapes Berlin auth, or moves instance state, the team must know the current remote Supabase database completely.

This PRD is the audit gate for that work.

The output is a single current-state inventory that proves:

- what exists in the remote Supabase project;
- what code currently calls it;
- what product domain, if any, owns it;
- whether it survives, is rebuilt, is merged, or is deleted;
- which later DB Pivot slice is allowed to touch it.

No implementation migration may start from screenshots, old migration names, partial table lists, or a code search alone.

## Product Reason

The current database is not trusted architecture. It contains accumulated Berlin/auth scaffolding, widget catalog residue, account policy fragments, control tables, functions, grants, RLS policies, and historical migration decisions.

The DB Pivot exists to simplify the product into:

- Accounts
- Users
- Instances state

But simplification is only safe if the existing database is fully inventoried first. Otherwise the team repeats the bad pattern that caused PRD 103 failure: seeing 10 percent of the system, changing that slice, and discovering later that another part of Clickeen depended on a different meaning.

## Non-Negotiable Rule

```text
No DB Pivot migration before the current remote Supabase inventory is complete and reviewed.
```

This includes "small" migrations, column additions, table deletes, RLS edits, function edits, local reset scripts, generated type changes, and dashboard schema changes.

## Scope

Inventory the current remote Supabase project linked to this repo:

```text
project ref: ebmqwqdexmemhrdhkmwn
```

The audit must cover the actual remote database, not just checked-in migration files.

The current terminal-safe fact is:

```text
local and remote migration history match through 20260514120000__prd98_account_public_ids
```

That fact is useful, but insufficient. Matching migration history does not prove the team understands every surviving object, caller, product meaning, or deletion risk.

## Required Inventory

The audit must list every object in the remote database:

| Object class | Required evidence |
| --- | --- |
| Tables | Name, purpose if known, row count estimate, owner domain, keep/merge/delete/defer decision. |
| Columns | Name, type, nullability, default, enum/domain usage, writer, reader, product meaning, keep/rename/delete decision. |
| Primary keys | Current key, product identity meaning, migration risk. |
| Foreign keys | Source, target, delete/update behavior, product relationship meaning. |
| Indexes | Columns, uniqueness, partial predicates, current query reason, keep/delete decision. |
| Enums/types/domains | Values, approved product vocabulary or deletion candidate. |
| RLS policies | Table, command, role, predicate, product boundary, keep/rebuild/delete decision. |
| Grants | Role/table/function grants, current security risk, target posture. |
| Functions/RPCs | Signature, caller map, product operation, keep/rebuild/delete decision. |
| Triggers | Table/function/event, reason, keep/delete decision. |
| Extensions | Name, why needed, keep/delete decision. |
| Publications/realtime | Enabled objects, product reason, keep/delete decision. |
| Storage/auth schema dependencies | Any public-schema dependency on Supabase auth/storage internals. |

The audit must also record every object that exists in migrations but no longer exists remotely, so old migration history is not mistaken for current product truth.

## Required Code Caller Map

For every surviving DB object, map current callers across:

- Berlin/auth code
- Roma
- Bob
- Tokyo/Tokyo-worker
- San Francisco
- Prague
- Venice
- scripts
- GitHub Actions / CI
- DevStudio/admin tools
- tests

The caller map must distinguish:

- active product path;
- admin/dev tool;
- test fixture;
- migration-only code;
- dead code;
- generated type/reference only.

An active caller is not proof that the object should survive. It is only proof that the migration plan must remove or rewrite that caller deliberately.

## Classification Vocabulary

Every object must receive one classification:

| Classification | Meaning |
| --- | --- |
| `keep` | The object already matches the approved DB Pivot product model and survives. |
| `rebuild` | The product need survives, but the current object is wrong and must be replaced. |
| `merge` | The product need survives but belongs inside one of the approved Accounts/Users/Instances tables or operations. |
| `delete` | The object is stale, bootstrap-era, duplicated truth, or storage-object/product-mode residue. |
| `defer` | The object is not approved for this pivot, but deletion requires a named later PRD because a real product feature depends on it. |
| `blocked` | The team cannot decide without a product decision. No implementation slice touching this object may proceed. |

## Approved Domains

Every object must map to one of these domains:

- Accounts
- Users
- Invite Members
- Billing status stub
- Instances state
- Berlin auth login method
- Future connector/account connection
- Policy/entitlement
- Audit/control
- Legacy widget catalog
- Legacy instance/widget scaffolding
- Local/bootstrap tooling
- Unknown

`Unknown` is not an acceptable green-state classification. Unknown objects block implementation.

## Tooling And Access Model

Because the current development machine is macOS Monterey and Docker Desktop is unavailable, this audit must not depend on local Supabase.

Allowed read-only tools:

- VS Code Supabase extension remote inspection.
- Supabase Dashboard SQL Editor for read-only inspection queries.
- `npx supabase@2.62.5 migration list --linked` for migration history only.
- Repo code search with `rg`.
- Checked-in migrations and docs.

Forbidden during this audit:

- `supabase db reset`
- `supabase db push`
- local Docker Supabase as evidence of remote state
- dashboard schema writes
- remote mutation SQL
- generating a new migration through `supabase db pull` unless Product + Architecture explicitly decide dashboard drift exists and must be captured as a migration

`supabase db pull` is not the first audit command. It writes a migration file and can turn drift into repo history before the team understands it.

## Required Remote Inspection Queries

The audit may use Supabase Dashboard SQL Editor or the VS Code extension to gather read-only data. Queries must be copied into the audit evidence document with their results summarized.

Minimum query families:

```sql
-- tables and row estimates
select schemaname, relname, n_live_tup
from pg_stat_user_tables
order by schemaname, relname;
```

```sql
-- columns
select table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

```sql
-- constraints
select tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
order by tc.table_name, tc.constraint_name;
```

```sql
-- indexes
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

```sql
-- RLS
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
-- functions/RPCs
select n.nspname as schema, p.proname as name, pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
```

```sql
-- triggers
select event_object_schema, event_object_table, trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name;
```

```sql
-- enum values
select n.nspname as schema, t.typname as enum_name, e.enumlabel as value
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;
```

## Required Artifact

Create and maintain:

```text
Execution_Pipeline_Docs/02-Executing/103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md
```

The audit artifact must include:

1. remote project ref and inspection date;
2. CLI migration list result summary;
3. full object inventory;
4. caller map;
5. keep/rebuild/merge/delete/defer/blocked decision for every object;
6. open product questions;
7. explicit migration blockers;
8. list of follow-up PRD edits required.

## Green Conditions

This PRD is green only when:

- every remote public DB object is inventoried;
- every remote public DB object has a product domain and classification;
- every active caller is mapped or marked unknown;
- no object remains `Unknown`;
- no implementation slice depends on a `blocked` object;
- parent DB Pivot PRD and child PRDs have been updated from the inventory;
- Product + Architecture explicitly approve which objects are kept, rebuilt, merged, deleted, or deferred;
- no mutation command was used during audit collection.

## Explicit Non-Goals

- Do not design the final schema in this audit.
- Do not write migration files in this audit.
- Do not fix Berlin auth in this audit.
- Do not move instance state in this audit.
- Do not delete the `widgets` table or any other table in this audit.

This PRD exists so later implementation is boring, deliberate, and complete.
