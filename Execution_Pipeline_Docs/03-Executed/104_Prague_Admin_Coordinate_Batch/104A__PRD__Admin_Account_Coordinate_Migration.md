# PRD 104A - Admin Account Coordinate Migration

Status: Draft for execution planning
Owner: Product + Architecture
Parent: [PRD 104](./104__PRD__Prague_Dogfood_Boundary_And_Admin_Account_Coordinate.md)
Depends on:
- `104B__PRD__Berlin_Roma_Account_Context_Cleanup.md`
- `104D__PRD__Prague_Locale_Stub_Cleanup.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`

## Purpose

Move the active Clickeen/admin account coordinate from `00000001` to `CLICKEEN` across Supabase, R2, Tokyo operations, scripts, docs, and public serving proof.

This is a data and coordinate migration. It must not introduce a slug, alias, redirect, or special account mode.

## Product Contract

After this PRD:

```text
CLICKEEN is the only active account coordinate for Clickeen-owned showcase instances.
00000001 is historical evidence only.
dev.clk.live/CLICKEEN/{instanceId} serves the published widget.
dev.clk.live/00000001/{instanceId} returns 404 with no redirect or alias.
```

## Required Sequence

The order is mandatory:

0. Verify `104B` is complete. Berlin/Roma must no longer emit `00000001` or the current `isPlatform` account/auth context path before this migration starts.
1. Copy source documents and assets from `accounts/00000001/` to `accounts/CLICKEEN/`.
2. Verify source config/content/assets are readable under `accounts/CLICKEEN/`.
3. Apply the Supabase account coordinate migration from `00000001` to `CLICKEEN`.
4. Republish/rematerialize admin-owned public artifacts under `accounts/CLICKEEN/`.
5. Verify public artifacts are served from `accounts/CLICKEEN/`.
6. Tombstone or delete `accounts/00000001/` after proof that no active route reads it.
7. Verify old public paths return `404` and do not redirect or alias.

Step 3 must not happen before Step 2. If Supabase identity moves first, Tokyo will resolve the new account id and may not find old source documents.

## DB FK Reality

Current Supabase account foreign keys are not assumed to have `ON UPDATE CASCADE`. The append-only migration must not rely on a blind primary-key update cascading across child tables.

The migration must be transactional. Old current-era migrations may still seed `00000001` on a fresh DB rebuild; do not edit them. The new append-only migration must run after them and correct both existing cloud-dev state and fresh rebuild state.

Required DB migration shape:

1. Assert `accounts.id = '00000001'` exists and `accounts.id = 'CLICKEEN'` does not.
2. Insert `accounts.id = 'CLICKEEN'` by copying the current admin account row.
3. Update dependent current rows, including `users.account_id`, `account_invitations.account_id`, and `instances.account_id`, from `00000001` to `CLICKEEN`.
4. Delete or tombstone the old `accounts.id = '00000001'` row only after dependent rows move.
5. Verify zero active Supabase rows reference `00000001`.
6. Verify tier, status, locale policy, selected locales, memberships, and admin-owned instance rows survived the move.
7. Verify `00000001` cannot resolve as an active account identity after migration.

Required post-migration verification tables:

```text
accounts
users
account_invitations
instances
```

Each must have zero active `00000001` rows after the migration.

## R2 Migration Mechanism

There is no existing general deploy sync script allowed to mutate `accounts/` runtime storage. Execution must provide one reviewed mechanism:

1. Preferred: add a one-off ops script, for example `scripts/ops/migrate-admin-account-coordinate-r2.mjs`, with dry-run, manifest, copy, verify, and tombstone/delete modes.
2. Acceptable alternative: provide an exact Cloudflare R2 runbook with list/copy/verify/tombstone/delete commands and captured evidence.

Wrangler v4 does not expose object-prefix listing as a usable `r2 object list` primitive in this repo. If the ops script is used, it must enumerate remote R2 through the S3-compatible API with explicit credentials:

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
TOKYO_R2_BUCKET
```

The R2 mechanism must produce evidence for:

```text
source keys discovered under accounts/00000001/
destination keys written under accounts/CLICKEEN/
byte/hash/etag verification where available
old public/source keys deleted only after CLICKEEN proof passes
tombstone marker written only after old public/source keys are deleted
```

## Blast Radius

Expected implementation areas:

| Area | Expected action |
| --- | --- |
| Supabase migrations/ops | Add a reviewed append-only migration, applied through the Supabase migration CI lane, that moves active admin compact account ID and admin-owned dependent rows from `00000001` to `CLICKEEN` without assuming `ON UPDATE CASCADE` |
| R2/Tokyo storage | Move active `accounts/00000001/` source documents/assets to `accounts/CLICKEEN/` before Supabase identity changes |
| Tokyo account routes | Verify account-scoped operations authorize and read/write under `CLICKEEN` without special-casing |
| `clk.live` public serving | Verify `/{accountPublicId}/{instanceId}` serves `CLICKEEN` and old `00000001` paths return `404` |
| Scripts/health | Update current admin smoke coordinate from `00000001` to `CLICKEEN`, including internal restore paths in `scripts/health/product-path-smoke.mjs` |
| Prague page data | Update active `tokyo/prague/pages/**/*.json` refs from `00000001` to `CLICKEEN` |
| Docs/tests | Update active docs/tests that name the current admin account coordinate |

Candidate edit set:

```text
supabase/migrations/**
scripts/health/product-path-smoke.mjs
scripts/ops/**
tokyo/prague/pages/**/*.json
tokyo-worker/src/**/*.test.ts
roma/**/*.test.ts
prague/README.md
documentation/services/prague/PraguePageAgentGuide.md
documentation/services/devstudio.md
documentation/services/roma.md
documentation/services/prague/prague-overview.md
documentation/services/prague/blocks.md
documentation/services/michael.md
documentation/services/tokyo-worker.md
documentation/architecture/CONTEXT.md
documentation/architecture/Overview.md
documentation/capabilities/multitenancy.md
documentation/widgets/WidgetComplianceSteps.md
documentation/widgets/WidgetPraguePagesBuilder.md
documentation/widgets/FAQ/FAQ_PraguePages.md
documentation/architecture/RuntimeProfiles.md
Execution_Pipeline_Docs/02-Executing/103_DB_*.md
```

Do not edit:

```text
bob/**
sanfrancisco/src/**
dieter/**
tokyo/product/widgets/**
```

## Drift Stop Conditions

Stop and revise if execution requires:

- changing customer account ID generation;
- adding slug or alias routing;
- redirecting old `00000001` URLs to `CLICKEEN`;
- treating `00000001` and `CLICKEEN` as both active;
- changing translation workflow to complete the migration;
- editing historical Supabase migrations instead of adding a new reviewed migration.
- hardcoding `CLICKEEN` in tests or scripts where the active tested account coordinate should be passed dynamically.

## Documentation Update Matrix

Active docs to update from `00000001` to `CLICKEEN`:

```text
documentation/services/prague/PraguePageAgentGuide.md
documentation/capabilities/multitenancy.md
documentation/services/devstudio.md
documentation/services/roma.md
documentation/services/prague/prague-overview.md
documentation/services/prague/blocks.md
documentation/services/michael.md
documentation/services/tokyo-worker.md
documentation/widgets/WidgetComplianceSteps.md
documentation/widgets/WidgetPraguePagesBuilder.md
documentation/widgets/FAQ/FAQ_PraguePages.md
prague/README.md
```

Documentation rules:

- Current instructional docs must not teach `00000001` as current product truth.
- `accountPublicId` may remain as an existing API/embed field name during cutover, but docs must say it carries the same compact `accounts.id`; it is not a second account identity.
- Cloud-dev public serving docs must use `https://dev.clk.live`; production release docs may use `https://clk.live`.
- Current smoke/runbook commands under `Execution_Pipeline_Docs/02-Executing/**` must receive replacement `CLICKEEN` commands or be marked clearly as pre-104A historical proof.

Historical docs allowed to retain `00000001`:

```text
Execution_Pipeline_Docs/03-Executed/**
immutable supabase/migrations/**
old execution evidence explicitly marked pre-104A
PDFs
external/generated competitor snapshots
```

Active product data:

```text
tokyo/prague/pages/faq/overview.json
tokyo/prague/pages/faq/examples.json
tokyo/prague/pages/faq/features.json
tokyo/prague/pages/faq/pricing.json
tokyo/prague/pages/countdown/overview.json
tokyo/prague/pages/logoshowcase/overview.json
```

These files must use `CLICKEEN` before Prague launch proof is accepted.

## Runtime Session Requirement

Berlin/Roma auth capsules can survive for a short period after issuance. Runtime proof must use a fresh login/session after the DB migration, or explicitly clear the Roma/Berlin auth cookies before smoke.

Required action:

```text
Clear/recreate ck-authz-capsule and related Roma/Berlin auth cookies before post-migration smoke.
```

## Prague Validation Requirement

When proving Prague page refs after the coordinate migration, run Prague validation in strict mode:

```text
PRAGUE_VALIDATE_ACCOUNT_INSTANCE=1
PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT=1
```

## Verification

Static checks:

```sh
rg -n "00000001" berlin roma tokyo-worker packages scripts tokyo/prague/pages documentation Execution_Pipeline_Docs/01-Planning Execution_Pipeline_Docs/02-Executing -S
rg -n "00000001" supabase/migrations -S
rg -n "slug-to-account|vanity" roma tokyo-worker berlin packages -S
rg -n "00000001" documentation prague/README.md scripts/health tokyo/prague/pages Execution_Pipeline_Docs/01-Planning Execution_Pipeline_Docs/02-Executing --glob '!Execution_Pipeline_Docs/03-Executed/**' --glob '!supabase/migrations/**' --glob '!documentation/widgets/**/CompetitorAnalysis/**' --glob '!**/*.pdf' -S
```

Expected result:

- `00000001` absent from active product code, active scripts, and current docs except historical evidence or clearly marked migration notes;
- immutable historical Supabase migrations may retain old seed evidence;
- a new reviewed migration moves active cloud-dev data to `CLICKEEN`;
- active Prague page JSON has no `00000001`;
- no active instructional docs teach `00000001` as current product truth;
- no new slug/alias routing system exists.

Runtime proof:

```text
2026-05-26 cloud-dev execution:
Supabase admin account truth returns CLICKEEN with tier3, active status, and 28 selected target locales.
Admin-owned dependent rows moved: users=2, account_invitations=5, instances=3.
Old active Supabase references are zero for users.account_id, account_invitations.account_id, and instances.account_id.
R2 source documents/assets were copied from accounts/00000001/ to accounts/CLICKEEN/ before the Supabase identity move.
Tokyo restorePaidTierServing was run through a temporary exact Cloudflare route for tokyo.dev.clickeen.com/__internal/accounts/CLICKEEN/serving/restore-paid, using TOKYO_DEV_JWT and devstudio.local internal-service auth.
The temporary route was removed immediately after the operation; the original Tokyo route list was restored.
Tokyo rematerialized all three published Clickeen-owned instances under CLICKEEN: UZ3JEJSHII, 8FMVZFFPJV, H7IF9M2K9B.
dev.clk.live/CLICKEEN/{UZ3JEJSHII,8FMVZFFPJV,H7IF9M2K9B} returns 200.
dev.clk.live/00000001/{UZ3JEJSHII,8FMVZFFPJV,H7IF9M2K9B} returns 404 with no redirect or alias.
Old migrated source/public R2 keys under accounts/00000001/ were deleted.
accounts/00000001/_PRD104A_TOMBSTONED.json exists and points to replacementAccountId CLICKEEN.
Product-path smoke uses CLICKEEN, including internal restore boundary assertions.
The internal restore-deny path uses the active tested account coordinate, not a hardcoded replacement literal.
Prague validation runs with PRAGUE_VALIDATE_ACCOUNT_INSTANCE=1 and PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT=1.
Post-migration smoke uses a fresh Berlin/Roma session or cleared auth cookies.
clk.live unit tests prove CLICKEEN serves when the object exists and 00000001 returns 404 when no old object exists.
```

## Acceptance

104A is complete when:

- the active admin account coordinate is `CLICKEEN`;
- active Supabase rows do not reference `00000001`;
- active R2 source/artifact paths for admin-owned instances are under `accounts/CLICKEEN/`;
- old `00000001` public paths return `404`;
- active Prague page data no longer references `00000001`;
- active scripts/docs/tests no longer treat `00000001` as current product truth;
- current docs explain that `accountPublicId` carries the compact account id and is not a second identity;
- R2 migration evidence includes dry-run/list/copy/verify/tombstone-or-delete proof;
- no alias, redirect, fallback, or second active coordinate exists.
