# PRD 099A - Evidence Lock And R2 Inventory

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 1 of 8

## Purpose

Establish the physical R2 root truth before any deploy sync, account migration, or deletion starts.

This slice proves the only allowed roots are:

```text
accounts/
dieter/
fonts/
product/
prague/
```

This slice is read-only. It classifies live R2 as source material. It does not mutate R2.

## Scope

In scope:

- inventory live `tokyo-assets-dev`
- classify every existing root as keep, move, recreate, or delete
- record object counts, byte totals, etags/last-modified where available, and sampled keys
- identify stale UUID account paths, `wgt_*`, `ins_*`, root `published/`, root `public/`, root `l10n/`, and root `widgets/`
- document every object class that remains outside `accounts/`

Out of scope:

- changing deploy tooling
- changing account instance runtime keys
- changing Venice public route shape
- deleting or moving any object

## Blast Radius

Likely touched:

- one small inventory/report script under `scripts/`
- optional JSON/Markdown inventory report under `Execution_Pipeline_Docs/02-Executing/`

Current suspect evidence:

- live screenshots show root `accounts/`, `fonts/`, `l10n/`, `public/`, `published/`, and `widgets/`
- screenshots show old admin UUID path `accounts/00000000-0000-0000-0000-000000000100/`
- screenshots show old `wgt_*` instance folders
- `.github/workflows/cloud-dev-prague-content.yml` checks `/l10n/prague/...`
- `scripts/prague-sync.mjs` publishes Prague overlays under old root paths

## Required Work

1. Establish the working R2 listing command. If `wrangler r2 object list` is unavailable in the installed Wrangler version, document the working alternative before proceeding.
2. Produce a complete inventory manifest with:
   - root prefix
   - object key
   - byte size where available
   - etag/hash where available
   - last modified where available
   - classification: `keep`, `move/recreate`, `delete`, or `blocker`
3. Sample and classify every object under:

```text
accounts/
fonts/
l10n/
public/
published/
widgets/
```

4. Fail if an unclassified root exists.
5. Do not apply any mutation in this slice.

## Verification

Required checks:

```bash
rg -n "l10n/prague|TOKYO_R2_BUCKET.*l10n|published/widgets|r2 object put .*widgets/" scripts .github tokyo-worker prague
rg -n "accounts/.*/widgets|accounts/[0-9a-f-]{36}|wgt_|ins_|published/widgets" tokyo-worker roma bob venice prague admin scripts documentation
```

Live R2 inventory must show no unclassified root.

## Stop Conditions

Stop if:

- live R2 cannot be listed reliably
- an object cannot be classified
- a deletion/move is required to finish inventory
- a script tries to mutate R2 during evidence lock

## Exit Criteria

- Complete R2 inventory report exists.
- Root `widgets/`, `l10n/`, `public/`, and `published/` are classified for deletion but not necessarily deleted yet.
- Stale account UUID paths and old `wgt_*`/`ins_*` artifacts are identified.
- `099B` can proceed with a reliable evidence baseline.

## Execution Evidence

- Inventory command: `node scripts/prd99a-r2-inventory.mjs`
- Complete manifest: `Execution_Pipeline_Docs/02-Executing/evidence/099A__r2_inventory_manifest.json`
- Inventory report: `Execution_Pipeline_Docs/02-Executing/099A__R2_Inventory_Report.md`
- Required deploy/root scan: `Execution_Pipeline_Docs/02-Executing/evidence/099A__scan_deploy_roots.txt`
- Required legacy path scan: `Execution_Pipeline_Docs/02-Executing/evidence/099A__scan_legacy_paths.txt`

Green checks:

- Live R2 listed through Cloudflare R2 object API using the existing Wrangler OAuth browser-auth session.
- Objects listed: 1,886.
- Observed roots: `accounts/`, `fonts/`, `l10n/`, `public/`, `published/`, `widgets/`.
- Unclassified roots: 0.
- Blocker-classified objects: 0.
- R2 mutations performed: none.
- `node --check scripts/prd99a-r2-inventory.mjs` passed.
- Manifest JSON parse/count verification passed.
- `git diff --check` on 099A artifacts passed.
