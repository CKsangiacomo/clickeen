# EXEC 103_DB.2 Core Schema Foundation - Accounts, Users, Invitations, Instances

Status: Green
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
- Dispatched `supabase migrations deploy` for `cloud-dev` after pushing commit `bf39f97e`.
- GitHub run `26283502362` failed before linking or touching Supabase because required migration secrets were not configured in Actions. The PRD guard passed in the run; failure occurred in the target-selection preflight.
- Workflow was tightened again to remove invented per-environment secret names. Cloud-dev uses the existing `SUPABASE_URL_CLOUD_DEV` repo variable as workflow `SUPABASE_URL` and derives the project ref from it. The only extra CI-only credentials are the Supabase CLI deployment credentials: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.
- Copied existing `.env.local` `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` values into same-name GitHub Actions secrets. No new secret names were introduced.
- Dispatched `supabase migrations deploy` for `cloud-dev` at commit `53d85b41`.
- GitHub run `26284503517` passed: guard, target selection, Supabase link, and migration deployment all succeeded.
- Read-only remote migration proof passed: `npx supabase@2.62.5 migration list --linked` shows local and remote `20260522090000`.
- Read-only REST shape proof passed: `accounts`, `users`, `account_invitations`, and `instances` respond; deleted tables `widgets`, `account_members`, `user_profiles`, `login_identities`, `user_contact_methods`, and `user_contact_verifications` return 404.

## Green Proof

- Migration exists in Git: `supabase/migrations/20260522090000__prd103_db_core_foundation.sql`.
- Migration deployed to cloud-dev by CI, not by agent/developer terminal.
- GitHub Actions run: `https://github.com/CKsangiacomo/clickeen/actions/runs/26284503517`.
- Remote migration history includes `20260522090000`.
- New V1 tables are reachable; deleted old tables are absent.
- Runtime Tokyo/Roma/Berlin wiring is intentionally not part of this slice and begins after this green gate.
