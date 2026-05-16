# PRD 099H - Migration Cleanup CI Guards And Closure

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 8 of 8

## Purpose

Finish PRD99 by recreating needed data, deleting stale roots, and installing guardrails so the old taxonomy cannot return.

Migration tooling is one-time operator tooling. It must not become a framework, router, compatibility layer, or permanent dual reader.

For PRD 099, "archive" means the script is moved out of active product/deploy paths and linked from the final execution report with the exact command, inputs, outputs, and date it was used. Archived migration tooling must not be imported by app code, run in CI product gates, or remain part of normal deploy scripts.

## Scope

In scope:

- dry-run migration/recreation reports
- stale root cleanup after route verification
- CI architecture guards
- rollback rehearsal against local/dev R2
- final R2 inventory proof
- execution report

Out of scope:

- long-lived old-path support
- generic R2 migration framework
- silent cleanup in runtime services

## Blast Radius

Likely touched:

- `scripts/**`
- `.github/workflows/pr-architecture-gates.yml`
- `.github/workflows/cloud-dev-*.yml`
- `Execution_Pipeline_Docs/02-Executing/**`
- final execution report under `Execution_Pipeline_Docs/03-Executed/`
- possible one-time JSON reports similar to prior `088__r2_migration_report.json`

## Required Work

1. Produce dry-run deletion reports before any deletion.
2. Verify all product-needed data exists in the new model:
   - widget software under `product/widgets/`
   - admin instances under `accounts/00000001/instances/`
   - account assets under `accounts/{accountPublicId}/assets/`
   - retained Prague content under `prague/`
3. Export a restore manifest for every stale object targeted for deletion.
4. Rehearse rollback on local/dev R2.
5. Delete stale roots after verification:

```text
public/
published/
l10n/
widgets/
```

6. Delete stale account paths after verification:

```text
accounts/{uuid}/widgets/**
accounts/{uuid}/instances/wgt_*
```

7. Add CI guards for banned roots/path builders.
8. Delete one-time migration scripts after use, or archive them outside active product/deploy paths with an execution-report link.
9. Move the parent PRD and slices to `03-Executed` with an execution report only after live R2, code, CI, and docs agree.

## Required Guard Scans

```bash
rg -n "public/instances|published/widgets|/l10n/widgets|l10n/base|accounts/.*/widgets|wgt_|ins_" tokyo-worker roma bob venice prague admin scripts documentation
rg -n "l10n/prague|accounts/[0-9a-f-]{36}|published/widgets|accounts/.*/widgets" tokyo-worker roma bob venice prague admin scripts documentation
rg -n "product/widgets|accounts/.*/instances|accounts/.*/assets|prague/l10n|renders/accounts|/widget/" tokyo-worker roma bob venice prague admin scripts documentation
```

The first two scans must have no active product-path matches. Historical docs may mention old paths only if clearly marked historical. CI must use scoped exclusions for old PRD/execution report text so false positives do not train people to ignore the guard.

## Verification

Required final checks:

- R2 root inventory is exactly `accounts/`, `dieter/`, `fonts/`, `product/`, `prague/`
- widget URLs serve R2 `product/widgets/`
- Roma opens/saves/publishes/unpublishes an admin instance under `00000001`
- Venice serves existing projections and returns 404/miss for missing projections
- Prague no longer depends on root `l10n/prague/`
- rollback restore has been rehearsed on local/dev R2
- migration scripts are gone or archived outside active product paths
- CI PRD99 guard is active

## Stop Conditions

Stop if:

- deletion plan lacks a dry-run report
- deletion plan lacks an object-level restore manifest
- rollback has not been rehearsed on local/dev R2
- any service still needs an old root
- migration tooling becomes a permanent runtime dependency
- CI cannot distinguish active product paths from historical docs
- live R2 inventory contains an unclassified root

## Exit Criteria

- PRD99 parent and slices have execution evidence.
- Live R2, code, CI, and docs agree.
- No service needs to remember old R2 shapes to serve the product.

## Execution Evidence

Completed: 2026-05-15

### R2 cleanup

- Live pre-cleanup dry run: `evidence/099H__r2_cleanup_dry_run.json`
- Dry-run report: `099H__R2_Cleanup_Dry_Run_Report.md`
- Admin asset migration result: `evidence/099H__asset_migration_result.json`
- Restore manifest: `evidence/099H__restore_manifest.json`
- Restore object bodies: `evidence/099H_restore_objects/`
- Rollback rehearsal result: `evidence/099H__rollback_rehearsal_result.json`
- Deletion result: `evidence/099H__r2_delete_result.json`
- Final live inventory: `evidence/099H__r2_inventory_final.json`
- Final cleanup report: `099H__R2_Final_Cleanup_Report.md`

The final R2 inventory is exactly:

```text
tokyo-assets-dev/
  accounts/
  dieter/
  fonts/
  product/
  prague/
```

The cleanup deleted stale root objects and legacy private-UUID account objects after exporting object bodies and rehearsing restore. Admin assets were copied from the old private UUID account folder to `accounts/00000001/assets/` before the UUID folder was deleted.

### Code and route guardrails

- Added `scripts/verify/prd99-storage-guard.mjs`.
- Wired the guard into root `pnpm lint`.
- Removed root `/l10n/*` Tokyo Worker route from `tokyo-worker/wrangler.toml`.
- Removed local Tokyo dev-server root `/l10n/` compatibility/proxy behavior.
- Deployed Tokyo Worker version `5a94dd5e-dabb-4821-8af2-530f6bbf8bc0`.

### Live route proof

Evidence: `evidence/099H__live_route_smoke.json`

- `/widgets/faq/catalog.json`: 200
- `/widgets/countdown/catalog.json`: 200
- `/widgets/logoshowcase/catalog.json`: 200
- `/prague/l10n/chrome/index.json`: 200
- old root `/l10n/prague/chrome/index.json`: 404
- `/widget/00000001/UZ3JEJSHII`: 200
- missing `/widget/00000001/ZZZZZZZZZZ`: 404
- `/renders/accounts/00000001/instances/UZ3JEJSHII/live/r.json`: 200
- old `/renders/widgets/UZ3JEJSHII/live/r.json`: 404

### Guard scans

- `evidence/099H__scan_active_banned_product_paths.txt`: 0 active matches
- `evidence/099H__scan_active_banned_storage_roots.txt`: 0 active matches
- `evidence/099H__scan_canonical_paths.txt`: canonical path usage evidence

Current docs may name old paths only as explicit prohibition/historical cleanup context, not as current product paths.

### Verification

- `node scripts/verify/prd99-storage-guard.mjs`: green
- `pnpm --filter @clickeen/tokyo-worker test`: green
- `pnpm --filter @clickeen/tokyo-worker typecheck`: green
- `node --check tokyo/dev-server.mjs && bash -n scripts/dev-up.sh`: green
- `pnpm lint`: green
- `pnpm typecheck`: green
- `pnpm --filter @clickeen/venice test`: green
