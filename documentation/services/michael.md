# Michael - Supabase Data Plane

STATUS: CURRENT SYSTEM OPERATOR SPEC

Michael is Clickeen's Supabase/Postgres data plane. It owns relational product
data. It does not own account runtime files.

For Supabase operation details, use
`documentation/engineering/SupabaseOperations.md`.

## Purpose

Michael stores relational state that product routes need to query, constrain,
or join:

- accounts;
- users;
- account invitations;
- account locale settings;
- instance registry/status rows;
- translation generation operation rows.

Additional billing, support, usage, reporting, or governance records may belong
in Michael only after a reviewed migration introduces them.

## Hard Boundary

Michael does not own:

- widget instance source documents;
- account assets;
- translated locale overlay files;
- generated public packages;
- page package files;
- public serving bytes.

Those are Tokyo/R2-owned runtime files under `accounts/{accountPublicId}/...`.

`public.instances` is a registry/status table. It is not Builder source truth,
not the generated package, not the translated overlay store, and not a second
instance storage system.

## Code Authority

| Concern | File |
| --- | --- |
| Supabase config | `supabase/config.toml` |
| SQL migrations | `supabase/migrations/*.sql` |
| Migration deploy workflow | `.github/workflows/supabase-migrations.yml` |
| Supabase operations runbook | `documentation/engineering/SupabaseOperations.md` |
| Berlin Supabase admin client | `berlin/src/supabase-admin.ts` |
| Berlin bootstrap/account locale reads | `berlin/src/bootstrap/**` |
| Berlin identity/account management | `berlin/src/identity/**`, `berlin/src/account-management/**` |
| Roma locale settings route | `roma/app/api/account/locales/route.ts` |
| Roma active-locale storage helper | `roma/lib/account-active-locales-storage.ts` |

## Current Runtime Tables

These are the Michael tables current product code depends on or current
migrations define.

| Table | Owned truth | Main runtime consumers |
| --- | --- | --- |
| `public.accounts` | compact account id, status, tier, account locale settings | Berlin bootstrap/login; Roma account locale settings |
| `public.users` | user id, account id, role, primary email, login provider subject, profile fields | Berlin login/session/account management |
| `public.account_invitations` | invitation id, account id, email, role, status, expiry and accept/revoke stamps | Berlin invitation login acceptance and team routes |
| `public.instances` | account-instance registry/status row only | translation operation foreign key and registry checks |
| `public.translation_generation_operations` | schema-present translation operation header rows | no current product-path runtime consumer found outside migrations/docs |
| `public.translation_generation_operation_locales` | schema-present per-locale translation operation status rows | no current product-path runtime consumer found outside migrations/docs |

Important vocabulary boundary:

- Product and UI vocabulary is **active locales**.
- The persisted `public.accounts` column that stores that list is named `selected_target_locales` in the current schema.
- Do not introduce a new product concept from schema column names. Code
  reads/writes account locale settings through helpers that expose
  `activeLocales`.

## Current Enums And Columns

Current enum values:

| Enum | Values |
| --- | --- |
| `public.account_status` | `active`, `suspended` |
| `public.account_tier` | `free`, `tier1`, `tier2`, `tier3`, `tier4` |
| `public.user_role` | `owner`, `admin`, `editor`, `viewer` |
| `public.login_provider` | `google` |
| `public.invitation_status` | `pending`, `accepted`, `revoked` |
| `public.instance_publish_status` | `unpublished`, `published` |
| `public.instance_translation_status` | `idle`, `queued`, `running`, `failed` |

Core table columns:

| Table | Columns |
| --- | --- |
| `public.accounts` | `id`, `status`, `status_changed_at`, `tier`, `created_at`, `selected_target_locales`, `locale_policy` |
| `public.users` | `user_id`, `account_id`, `role`, `primary_email`, `login_provider`, `login_subject`, `first_name`, `middle_name`, `last_name`, `primary_language`, `country`, `timezone`, `phone`, `whatsapp`, `created_at` |
| `public.account_invitations` | `id`, `account_id`, `email`, `role`, `status`, `created_at`, `expires_at`, `accepted_at`, `revoked_at` |
| `public.instances` | `id`, `account_id`, `widget_type`, `publish_status`, `translation_status`, `created_at`, `edited_at` |
| `public.translation_generation_operations` | schema-present operation table from `supabase/migrations/20260528120000__prd105_translation_generation_operations.sql`; no current product-path runtime consumer found |
| `public.translation_generation_operation_locales` | schema-present operation table from `supabase/migrations/20260528120000__prd105_translation_generation_operations.sql`; no current product-path runtime consumer found |

Translation operation tables are RLS-enabled and granted to `service_role`;
`anon` and `authenticated` have no access. Do not route browser reads/writes to
these tables directly.

## Current Functions

| Function | Purpose | Called by |
| --- | --- | --- |
| `public.resolve_login_identity(...)` | Resolve or create the Clickeen user/account for a verified Google identity. | Berlin login flow |
| `public.accept_login_invitation_identity(...)` | Accept an invitation during login and create/resolve the invited user in the invited account. | Berlin invitation login flow |
| `public.transfer_account_owner(...)` | Transfer account ownership inside Berlin account-management routes. | Berlin account governance |

These functions are service-role paths. Product surfaces do not call Supabase
directly from the browser.

## Runtime Consumers

| Consumer | Uses Michael for |
| --- | --- |
| Berlin | login identity resolution, invitation acceptance, session bootstrap, account/user/role/profile governance, account locale reads |
| Roma | current-account locale settings writes and reads through same-origin routes |
| Migration workflow | schema deployment to cloud-dev Supabase |

Tokyo-worker is not a Michael consumer for account runtime files. Tokyo-worker
owns R2 storage operations.

## Environment And Secrets

Migration deploy credentials are documented in
`documentation/engineering/SupabaseOperations.md`.

Product runtime credentials:

| Runtime owner | Required env/secret | Purpose |
| --- | --- | --- |
| Berlin Worker | `SUPABASE_URL` | cloud-dev Supabase project URL |
| Berlin Worker | `SUPABASE_SERVICE_ROLE_KEY` | account/session/bootstrap relational access |
| Roma Pages | `SUPABASE_URL` | cloud-dev Supabase project URL for account settings routes |
| Roma Pages | `SUPABASE_SERVICE_ROLE_KEY` | service-role account locale/settings writes |
| Roma Pages CI/build verification | `SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY_CLOUD_DEV` | Supabase client/build check dependency where the workflow provides it |

Do not commit secret values. Do not use Supabase Auth as the product login
authority; Berlin owns product auth.

## Account Identity

`accounts.id` is the first-class compact account product/storage coordinate:

```text
^[0-9A-Z]{8}$
```

`accountPublicId` is the API/embed/authz field name for that same value. It is
not a second identity, slug, UUID folder, or alias.

Tokyo/R2 account folders must use that compact account coordinate:

```text
accounts/{accountPublicId}/...
```

Runtime note: current schema stores the compact coordinate directly in
`accounts.id`. Do not revive UUID account folders or a separate
`accounts.public_id` authority.

## Account Locale Settings

Roma Settings writes the account locale state to `public.accounts`:

| Product concept | Schema column | Code helper |
| --- | --- | --- |
| active locales | `selected_target_locales` | `roma/lib/account-active-locales-storage.ts` |
| locale policy / base locale | `locale_policy` | `roma/lib/account-active-locales-storage.ts` and `@clickeen/ck-contracts` parsers |

Rules:

- Roma owns the account settings operation.
- Berlin reads the same columns during bootstrap/account context.
- Translation overlay files stay in Tokyo/R2, not Michael.
- Changing active locales can cause Roma to call Tokyo-worker for removed locale
  overlay deletion and Translation Agent for added locale overlay creation.
- Michael stores only the account settings row. It does not store overlay files
  or generated translation values.

## Schema Change Path

Schema changes are not product-route changes. They require:

1. append-only SQL migration under `supabase/migrations/`;
2. review against Michael ownership boundaries;
3. deployment through GitHub Actions `supabase migrations deploy`;
4. runtime verification through the owning product surface.

Dispatch/read-back commands:

```bash
gh workflow run supabase-migrations.yml \
  -f target=cloud-dev \
  -f confirm=APPLY_MIGRATIONS \
  -f repair_applied_versions=

gh run list --workflow supabase-migrations.yml --limit 5
gh run view [run id] --log
```

Failure triage:

- Workflow uses `SUPABASE_URL_CLOUD_DEV` to derive the project ref.
- Workflow credentials and CLI sequence are documented in `documentation/engineering/SupabaseOperations.md`.
- Use `repair_applied_versions` only when the exact migration file exists and the repair reason is recorded.

## Verification

| Change touched | Verify through |
| --- | --- |
| Migration deployment | GitHub Actions `supabase migrations deploy` run |
| Berlin auth/session/account schema | Berlin `/session/bootstrap` or Roma `/api/bootstrap` |
| Roma session/account shell | Roma `/api/me` |
| Account locale schema | Roma `/api/account/locales` |
| Account identity invariant | product routes expose compact `accountPublicId`; no UUID account storage path introduced |

Local Supabase is local debugging only. It is not cloud-dev product evidence.

## Hard Stops

- Do not run ad hoc remote SQL outside the reviewed migration path.
- Do not edit remote tables manually in Supabase Studio and call the repo done.
- Do not run local `supabase db push` directly against cloud-dev as a shortcut.
- Do not recreate widget-instance storage in Supabase.
- Do not add a second account identity or storage coordinate.
- Do not move Tokyo/R2 runtime file ownership into Supabase.
- Do not dispatch migrations from an unreviewed branch/SHA.
- Do not use `repair_applied_versions` unless each exact version exists under
  `supabase/migrations/` and the reason is recorded.
