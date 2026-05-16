# PRD 099G - Admin Account Recreation And Data Cutover

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 7 of 8

## Purpose

Recreate the Clickeen/admin account data in the PRD99 account runtime model.

Admin is a normal account with broader permissions. It must not keep an admin-specific widget lane.

## Preconditions

- `099C` account runtime storage contract is implemented.
- `099D` Tokyo-worker PBX routes are implemented.
- `099E` public projection contract is implemented.
- The real Clickeen/admin account has `accountPublicId = 00000001` in Michael/Berlin.

## Scope

In scope:

- verify admin account public identity
- recreate admin instances under `accounts/00000001/instances/{instanceId}/`
- regenerate overlays where old overlay IDs encode wrong account or instance segments
- preserve widget software references as metadata (`widgetType`, `widgetCode`) inside instance documents
- verify Roma/Bob/Admin can open/save/publish/unpublish admin instances

Out of scope:

- preserving old UUID folder names
- preserving `wgt_*` or `ins_*` as current storage identity
- moving old overlay bodies when their IDs no longer match the target account/instance
- deleting stale roots

## Blast Radius

Likely touched:

- one-time migration/recreation scripts under `scripts/`
- admin/dev fixtures
- `Execution_Pipeline_Docs/02-Executing/099A` inventory report
- `tokyo-worker` migration helpers if needed
- Roma/Admin smoke fixtures

Current old source material:

```text
accounts/00000000-0000-0000-0000-000000000100/instances/wgt_*
accounts/00000000-0000-0000-0000-000000000100/widgets/**
```

These are source material only. They are not preserved as product paths.

## Required Work

1. Verify `00000001` is the real admin account public ID.
2. Build a mapping from old source material to recreated admin instances.
3. Mint or verify current compact instance IDs.
4. Recreate `instance.json`, `config.json`, `publish.json`, overlays, selected-overlay pointers, and published projections under:

```text
accounts/00000001/instances/{instanceId}/
```

5. For every overlay, parse the `overlayId` and verify:

```text
overlayId.accountPublicId === "00000001"
overlayId.instanceId === target instanceId
```

If that is not true, regenerate/recreate the overlay. Do not mechanically move the old object.

## Verification

```bash
rg -n "00000000-0000-0000-0000-000000000100|accounts/.*/widgets|wgt_|ins_" admin roma bob tokyo-worker scripts
rg -n "00000001|accounts/.*/instances|overlayId" admin roma bob tokyo-worker scripts
```

Product smoke:

- Roma lists admin instances from `accounts/00000001/instances/`
- Bob opens one admin instance
- Bob saves it
- Roma publishes/unpublishes it
- Venice serves the published projection through `/widget/00000001/{instanceId}` and returns miss after unpublish/removal

## Stop Conditions

Stop if:

- admin `00000001` is not the real account public ID
- an old overlay ID cannot be regenerated to match the recreated account/instance
- admin tooling needs a separate storage lane
- a recreated admin instance requires `wgt_*`, `ins_*`, or UUID folder identity

## Exit Criteria

- Admin examples are normal account instances.
- Old admin UUID paths are no longer required by product/dev flows.
- `099H` can safely delete stale admin source material after final verification.

## Execution Evidence

- Admin account public identity verified in Michael/Berlin: `Execution_Pipeline_Docs/02-Executing/evidence/099G__admin_account_public_id_verification.json`
- Recreation plan: `Execution_Pipeline_Docs/02-Executing/evidence/099G__admin_account_recreation_plan.json`
- Remote R2 recreation result: `Execution_Pipeline_Docs/02-Executing/evidence/099G__admin_account_recreation_result.json`
- Recreation report: `Execution_Pipeline_Docs/02-Executing/099G__Admin_Account_Recreation_Report.md`
- Legacy/source scan: `Execution_Pipeline_Docs/02-Executing/evidence/099G__scan_legacy_admin_account_storage.txt`
- Canonical account-instance scan: `Execution_Pipeline_Docs/02-Executing/evidence/099G__scan_admin_account_instance_contract.txt`
- Venice public smoke:
  - `Execution_Pipeline_Docs/02-Executing/evidence/099G__venice_public_smoke_faq.json`
  - `Execution_Pipeline_Docs/02-Executing/evidence/099G__venice_public_smoke_countdown.json`
  - `Execution_Pipeline_Docs/02-Executing/evidence/099G__venice_public_smoke_logoshowcase.json`

Selected admin account examples were recreated as normal account instances:

```text
accounts/00000001/instances/UZ3JEJSHII/  faq
accounts/00000001/instances/H7IF9M2K9B/  countdown
accounts/00000001/instances/8FMVZFFPJV/  logoshowcase
```

The old UUID/account-widget sources remain source material only for `099H` cleanup and are not current product paths.
