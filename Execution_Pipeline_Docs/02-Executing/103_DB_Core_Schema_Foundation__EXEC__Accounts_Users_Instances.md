# EXEC 103_DB.2 Core Schema Foundation - Accounts, Users, Invitations, Instances

Status: In Progress - Migration Draft Ready For CI Deployment
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.2 - Supabase core schema foundation`

## Rule

This slice creates the schema foundation only.

No agent terminal command may apply this migration to remote Supabase. Remote mutation must happen through the approved migration/CI deployment path after review.

## Why This Slice Exists

The original execution order tried to start with the instance registry/control row.

That is wrong because the approved `instances.account_id` references the new compact `accounts.id`. The current DB still has old UUID `accounts.id` plus compact `accounts.public_id`. Creating `instances` against the old account model would preserve the exact identity split this pivot is deleting.

So 103_DB.2 is the schema foundation for the four approved core tables:

- `accounts`
- `users`
- `account_invitations`
- `instances`

Runtime Tokyo/Roma wiring follows in `103_DB.3`.

## Migration Artifact

Migration file:

```text
supabase/migrations/20260522090000__prd103_db_core_foundation.sql
```

The migration:

- creates `citext` and `pgcrypto` extensions if needed;
- validates current compact account ids from `accounts.public_id`;
- stages current accounts from the old `accounts` table into temp source rows;
- stages current users from old `account_members`, `user_profiles`, and `login_identities`;
- chooses one V1 login identity per user by product priority: `google`, then `email`;
- stages current invitations from old `account_invitations`;
- drops old bootstrap/auth/widget/account schema surfaces;
- creates closed enum vocabularies for account status, tier, role, login provider, invitation status, publish status, and translation status;
- creates the approved `accounts`, `users`, `account_invitations`, and `instances` tables;
- enables RLS on the approved tables;
- grants only service-role access from the API path.

## Deployment Lane

Supabase migration application is not performed from an agent/developer terminal.

This slice adds the manual CI deployment lane:

```text
.github/workflows/supabase-migrations.yml
```

The workflow:

- runs only by `workflow_dispatch`;
- requires `confirm = APPLY_MIGRATIONS`;
- requires a named target: `cloud-dev` or `production`;
- uses environment-scoped Supabase secrets;
- runs `scripts/verify/prd103-db-pivot-guard.mjs` before linking or applying migrations;
- applies reviewed committed migrations through the Supabase CLI inside CI.

Production must not be dispatched until the same migration has been verified on cloud-dev.

## Target Tables

| Table | Status | Notes |
| --- | --- | --- |
| `accounts` | Created by migration | `id`, `status`, `status_changed_at`, `tier`, `created_at` only. |
| `users` | Created by migration | One user belongs to one account; role lives on `users`; login method columns are constrained. |
| `account_invitations` | Created by migration | V1 Invite Members lifecycle table. |
| `instances` | Created empty by migration | Runtime rows are created/migrated by Tokyo in 103_DB.3 / 103_DB.8. |

## Delete/Rebuild Targets In This Migration

The migration drops old foundations that cannot survive as product truth:

- `widgets`
- `widget_instances`
- `curated_widget_instances`
- l10n/generation/overlay DB tables
- `account_members`
- `user_profiles`
- `login_identities`
- contact verification scaffolding
- account commercial/control/containment scaffolding
- workspace-era tables
- stale account/user helper functions

## Open Verification Before Green

- migration file passes static diff checks;
- migration file does not contain `public_id` as a target column;
- migration file does not create `account_members`, `user_profiles`, `login_identities`, or `widgets`;
- migration file does not create DB storage for widget payloads, translated values, locale readiness, job history, or generated artifacts;
- no remote Supabase mutation was run from the agent terminal;
- child PRDs match the migration columns/enums.

## Verification Log

2026-05-22:

- `rg` guard passed: migration does not create old core tables (`account_members`, `user_profiles`, `login_identities`, `widgets`, `widget_instances`) and does not create payload/job/history storage columns/tables.
- `rg` guard passed: migration creates only the approved core table/type/index families for this slice.
- `bash -n scripts/dev-up.sh` passed.
- `git diff --check` passed.
- No remote Supabase mutation command was run.

2026-05-22 follow-up:

- Added manual CI-only Supabase migration deploy workflow at `.github/workflows/supabase-migrations.yml`.
- Added `scripts/verify/prd103-db-pivot-guard.mjs` to root `pnpm lint`.
- Updated PR architecture gate paths so `supabase/**` changes trigger the architecture gate.
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-migrations.yml"); YAML.load_file(".github/workflows/pr-architecture-gates.yml")'` passed.
- `node --check scripts/verify/prd103-db-pivot-guard.mjs && node scripts/verify/prd103-db-pivot-guard.mjs` passed.
- `pnpm verify:prd103-db-pivot` passed.
- `pnpm lint` passed.

Not green yet:

- migration has not been applied through the approved CI/deploy path;
- no remote schema proof exists yet;
- runtime Tokyo/Roma wiring is not started until this slice is green.
