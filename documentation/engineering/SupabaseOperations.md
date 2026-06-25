# Supabase Operations

STATUS: CURRENT SYSTEM OPERATOR SPEC

Supabase is Michael's managed Postgres runtime. It owns current relational
product data: accounts, users, account invitations, account locale settings,
instance registry rows, and translation generation operation rows.

Supabase does not own widget instance source, account assets, translated locale
overlays, generated public packages, or page package files. Those live in
Tokyo/R2.

Additional billing, support, usage, reporting, or governance tables may belong
in Michael only after a reviewed migration introduces them. They are not
current runtime truth until the migration exists and the owning service doc is
updated.

## AI Operator Quick Start

If the task changes schema, write a reviewed SQL migration under:

```text
supabase/migrations/
```

Then deploy through the GitHub Actions workflow:

```text
.github/workflows/supabase-migrations.yml
```

Workflow name:

```text
supabase migrations deploy
```

Required dispatch inputs:

```text
target = cloud-dev
confirm = APPLY_MIGRATIONS
repair_applied_versions = [optional comma-separated migration versions]
```

CLI dispatch/read-back path:

```bash
gh workflow run supabase-migrations.yml \
  -f target=cloud-dev \
  -f confirm=APPLY_MIGRATIONS \
  -f repair_applied_versions=

gh run list --workflow supabase-migrations.yml --limit 5
gh run view [run id] --log
```

Do not say "I cannot do Supabase" until you have checked whether the workflow,
required repo variables, and required secrets exist.

If the workflow is blocked, report:

- missing or rejected `SUPABASE_ACCESS_TOKEN`;
- missing or rejected `SUPABASE_DB_PASSWORD`;
- missing `SUPABASE_URL_CLOUD_DEV`;
- failed `supabase link`;
- failed migration repair;
- failed `supabase db push --linked`.

## Hard Stops

Never do these to make database work pass:

- do not run ad hoc remote SQL outside the reviewed migration path;
- do not run local `supabase db push` directly against cloud-dev as a shortcut;
- do not edit remote tables manually in Supabase Studio and call the repo done;
- do not recreate widget-instance storage in Supabase;
- do not add a second account identity or storage coordinate;
- do not use Supabase Auth as the product login authority;
- do not put secret values in docs or migrations;
- do not treat local Supabase state as cloud-dev evidence;
- do not mark migrations applied unless the reviewed repair list is explicit.
- do not dispatch migrations from an unreviewed branch/SHA;
- do not use `repair_applied_versions` unless each exact version exists under
  `supabase/migrations/` and the reason is recorded in the execution artifact.

## Code Authority

| Concern | File |
| --- | --- |
| Supabase config | `supabase/config.toml` |
| SQL migrations | `supabase/migrations/*.sql` |
| Migration deploy workflow | `.github/workflows/supabase-migrations.yml` |
| Account DB service doc | `documentation/services/michael.md` |
| Berlin account/session DB access | `berlin/src/**` |
| Roma account settings DB access | `roma/app/api/account/locales/route.ts` and account routes |
| Roma active-locale storage helper | `roma/lib/account-active-locales-storage.ts` |
| Berlin Supabase admin client | `berlin/src/supabase-admin.ts` |
| Berlin bootstrap/account locale reads | `berlin/src/bootstrap/**` |

## Deployment Authority

The current deployment authority is GitHub Actions:

```text
supabase migrations deploy
```

The workflow:

1. accepts only `target = cloud-dev`;
2. requires `confirm = APPLY_MIGRATIONS`;
3. installs Supabase CLI `2.101.0`;
4. derives the project ref from `SUPABASE_URL_CLOUD_DEV`;
5. verifies required secrets/env as part of target selection;
6. runs `supabase link --project-ref [project ref]`;
7. optionally runs reviewed `supabase migration repair [version] --status applied --linked`;
8. runs `supabase db push --linked`.

Required GitHub environment:

| Name | Kind | Purpose |
| --- | --- | --- |
| `SUPABASE_URL_CLOUD_DEV` | repo/environment variable | cloud-dev Supabase project URL |
| `SUPABASE_ACCESS_TOKEN` | secret | Supabase CLI access token |
| `SUPABASE_DB_PASSWORD` | secret | database password for migration deploy |

If `SUPABASE_URL_CLOUD_DEV` is missing or malformed, the current workflow may
fail while deriving the project ref before printing the custom missing-variable
message. Treat that as the same boundary: fix the configured cloud-dev Supabase
URL, then rerun the workflow.

## Product Runtime Environment

Migration credentials are not product runtime credentials.

| Runtime owner | Required env/secret | Purpose |
| --- | --- | --- |
| Berlin Worker | `SUPABASE_URL` | cloud-dev Supabase project URL |
| Berlin Worker | `SUPABASE_SERVICE_ROLE_KEY` | account/session/bootstrap relational access |
| Roma Pages | `SUPABASE_URL` | cloud-dev Supabase project URL for account settings routes |
| Roma Pages | `SUPABASE_SERVICE_ROLE_KEY` | service-role account locale/settings writes |

Do not put runtime Supabase secret values in git. Do not replace Berlin auth
with Supabase Auth.

## Local Supabase

`supabase/config.toml` is local CLI configuration. It can support isolated local
debugging, but local Supabase is not product runtime evidence.

Current local config facts:

| Setting | Value |
| --- | --- |
| project id | `clickeen` |
| database major version | `17` |
| local API port | `54321` |
| local DB port | `54322` |
| local Studio port | `54323` |
| migrations enabled | yes |
| seed enabled | false |

Use local Supabase only to reason about migrations. Cloud-dev truth comes from
the deployed Supabase project and the migration workflow evidence.

## Schema Ownership

Michael/Supabase owns relational state:

- `public.accounts`;
- `public.users`;
- `public.account_invitations`;
- `public.instances` as registry/status rows only;
- `public.translation_generation_operations` as translation operation
  coordination rows only;
- additional relational records only after a migration introduces them.

Tokyo/R2 owns account runtime files:

- `accounts/{accountPublicId}/assets/**`;
- `accounts/{accountPublicId}/instances/**`;
- `accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/**`;
- `accounts/{accountPublicId}/instances/{instanceId}/index.html`;
- `accounts/{accountPublicId}/instances/{instanceId}/styles.css`;
- `accounts/{accountPublicId}/instances/{instanceId}/runtime.js`;
- `accounts/{accountPublicId}/pages/**`.

Do not move runtime file ownership into Supabase.

Boundary: `public.instances` can identify and relate an instance to an account,
but it is not the Builder source document, generated package, translated
overlay store, public serving package, or account asset store.

## Current Account Coordinate

Current account product/storage coordinate:

```text
accounts.id
```

Format:

```text
^[0-9A-Z]{8}$
```

`accountPublicId` is the API/embed/authz field name for the same compact value.
It is not a second database identity, slug, UUID folder, or alias.

## Migration Rules

Every schema change must be an append-only SQL migration in:

```text
supabase/migrations/
```

Migration file names follow the existing pattern:

```text
YYYYMMDDHHMMSS__description.sql
```

Migration requirements:

- make ownership boundaries explicit in SQL comments when the migration touches
  account identity, users, invitations, or account settings;
- use explicit constraints for product law where possible;
- preserve service-role-only access where product code relies on service
  boundaries;
- avoid broad grants to `anon` or `authenticated` unless the product route
  explicitly requires direct Supabase access;
- do not silently repair corrupt product state without an explicit migration
  comment and rollback/recovery reasoning;
- do not recreate deleted pre-GA widget-instance tables or storage authority.

## Repair Applied Versions

The workflow supports:

```text
repair_applied_versions = [comma-separated versions]
```

Use it only when a reviewed migration is already applied remotely but the
Supabase migration history needs to be marked. The workflow runs:

```bash
supabase migration repair [version] --status applied --linked
```

This is not a general bypass. It must name exact reviewed versions.

## Runtime Verification

| Concern | Verification |
| --- | --- |
| Migration deployed | GitHub Actions `supabase migrations deploy` run succeeded |
| Project selected | workflow output derived project ref from `SUPABASE_URL_CLOUD_DEV` |
| Migration history repair | workflow log lists exact repaired versions |
| Schema behavior used by Berlin | Berlin `/session/bootstrap` succeeds against cloud-dev |
| Schema behavior used by Roma session shell | Roma `/api/bootstrap` or `/api/me` succeeds against cloud-dev |
| Account locale schema | Roma `/api/account/locales` succeeds against cloud-dev |
| Account identity invariant | product routes expose compact `accountPublicId`; no UUID account storage path introduced |

If runtime behavior needs proof, verify through the owning product surface
first: Berlin for auth/session/account bootstrap, Roma for account product
routes, Tokyo-worker/R2 for runtime files.

## Failure Semantics

| Case | Result |
| --- | --- |
| Missing `SUPABASE_URL_CLOUD_DEV` | workflow fails before linking |
| Missing `SUPABASE_DB_PASSWORD` | workflow fails before linking/deploy |
| Missing `SUPABASE_ACCESS_TOKEN` | workflow fails before linking/deploy |
| Unknown target | workflow fails |
| Confirm not `APPLY_MIGRATIONS` | deploy job does not run |
| Migration SQL fails | `supabase db push --linked` fails |
| Runtime route fails after migration | treat as product/schema regression and debug through owning service |

## Not Current Product Truth

- Supabase Auth as customer product login authority.
- Supabase as widget instance storage.
- Supabase as account asset storage.
- Supabase as translated locale overlay storage.
- Supabase as public package storage.
- Direct table edits as product operations.
