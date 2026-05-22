# EXEC 103_DB.3 Tokyo Instance Registry/Control Row Wiring

Status: In Progress - Runtime Cutover Ready For Cloud Deploy
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Child PRD: `103_DB_Instances__PRD__Instances_Table.md`
Execution slice: `103_DB.3 - Tokyo instance registry/control row wiring`

## Slice Intent

Tokyo must use the Supabase `instances` row as the authority for instance existence, account ownership, widget type, publish state, coarse translation state, creation time, and last user edit time.

The authored payload remains Tokyo-owned payload behind product operations. The DB row does not store display name, title, content, config, translated values, source versions, job IDs, overlay IDs, or storage paths.

## Implemented Locally

- Added Tokyo `instance-registry` operations backed by Supabase/PostgREST service-role calls.
- Changed account instance list to query `instances` first, then read private Tokyo config payload only for display label/config summary.
- Changed open/save/rename/delete/publish/unpublish resolution to require the `instances` row.
- Changed publish state reads/writes to use `instances.publish_status`, not payload JSON or public artifact presence.
- Removed the active `instance-index` module and its generated account index tests.
- Updated Tokyo tests so the test harness uses an in-memory Supabase/PostgREST registry instead of R2 account-index discovery.

## Current Instance Migration Evidence

Before deploying DB-backed runtime code, current cloud-dev instances must exist in `instances`.

Read-only R2 evidence gathered on 2026-05-22:

- `accounts/00000001/instances/index.json` exists and lists exactly:
  - `H7IF9M2K9B` / `countdown` / `published`
  - `UZ3JEJSHII` / `faq` / `published`
  - `8FMVZFFPJV` / `logoshowcase` / `published`
- `accounts/AYAXJRGD/instances/index.json` does not exist.
- Each listed admin instance has a matching `instance.config.json` with the same `id`, `accountId`, `widgetType`, `publishStatus`, `createdAt`, and `updatedAt`.

Migration file:

- `supabase/migrations/20260522114000__prd103_current_instance_registry_seed.sql`

Migration deploy proof:

- Git commit: `daad4571 feat(db): seed PRD103 current instance registry`
- GitHub Actions run: `26285753466`
- Result: success

Read-only Supabase proof after deploy:

- `instances` contains exactly the three current admin rows for account `00000001`:
  - `H7IF9M2K9B` / `countdown` / `published` / `idle`
  - `UZ3JEJSHII` / `faq` / `published` / `idle`
  - `8FMVZFFPJV` / `logoshowcase` / `published` / `idle`

## Verification Run

Local verification currently green:

- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm verify:prd103-db-pivot`
- `pnpm typecheck`
- `pnpm lint`
- `git diff --check`

## Not Green Yet

Do not close this slice until:

- the Tokyo worker cutover is pushed and cloud-dev deploy is green;
- Roma can list/open FAQ, Countdown, and Logo Showcase through Tokyo with DB-backed instance authority;
- grep guard shows no active product path uses account index JSON or R2 listing for instance discovery.
