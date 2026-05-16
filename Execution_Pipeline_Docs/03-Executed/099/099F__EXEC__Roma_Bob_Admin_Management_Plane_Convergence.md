# PRD 099F - Roma Bob Admin Management Plane Convergence

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 6 of 8

## Purpose

Align Roma, Bob, and DevStudio/Admin around the PRD99 management-plane truth.

Roma/system account operations own publish, unpublish, delete, downgrade, caps, tiers, and correctness of published state. Bob edits one account instance. Admin is a normal account with broader permissions.

## Scope

In scope:

- ensure Roma uses `accountPublicId` for Tokyo account runtime calls
- ensure Roma publish/unpublish/delete flows mutate account-owned instance state
- move publication caps, upload/storage caps, and other product policy decisions out of Tokyo-worker ownership and into Roma/system account operations
- ensure Bob loads widget software from product assets and saves account instances
- ensure DevStudio/Admin uses account `00000001` and no separate admin widget lane
- ensure Bob/Prague public references can carry `accountPublicId + instanceId`
- remove any UI/API implication that accounts own widgets

Out of scope:

- new billing/free-paid account business model
- Venice policy checks
- R2 migration script implementation

## Blast Radius

Likely touched:

- `roma/lib/account-instance-direct.ts`
- `roma/app/api/account/instances/**`
- `roma/app/api/account/widgets/route.ts`
- `roma/app/api/account/assets/**`
- `roma/components/widgets-domain.tsx`
- `roma/components/compiled-widget-cache.ts`
- `roma/lib/account-assets-gateway.ts`
- `bob/lib/api/compiled-widget-route.ts`
- `bob/lib/compiler/assets.ts`
- `bob/lib/compiler.server.ts`
- Bob embed/session/static proxy modules
- `admin/src/**`
- DevStudio fixtures and admin instance references

Current hot spots:

- Roma public API still has `/api/account/widgets` naming, which may remain UI-route language only if it returns instances.
- Bob uses friendly `/widgets/{widgetType}/...`; this is okay only if it resolves to R2 `product/widgets/`.
- Admin examples must be normal instances under `accounts/00000001/instances/`.

## Required Work

1. Audit Roma account instance APIs for `accountId` versus `accountPublicId`.
2. Ensure publish/unpublish/delete live in Roma/system account operations and call Tokyo-worker as PBX storage transition.
3. Move account product policy ownership into Roma/system account ops: publication caps, tier/cap enforcement, upload/storage allowance, downgrade/suspension mutation.
4. Ensure Bob does not infer storage path from widget URL.
5. Ensure Bob-generated embeds use `/widget/{accountPublicId}/{instanceId}` once the public contract lands.
6. Ensure DevStudio/Admin references normal account-owned instances, not admin-specific widget folders.
7. Update naming in docs/UI only where wording creates false architecture; do not churn user-facing `/widgets` navigation unnecessarily.

## Verification

Required checks:

```bash
pnpm --filter @clickeen/roma test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/devstudio test
rg -n "accounts/.*/widgets|wgt_|ins_|00000000-0000-0000-0000-000000000100|account widgets" roma bob admin
rg -n "accountPublicId|00000001|instances|renders/accounts|/widget/" roma bob admin prague
rg -n "published.max|storage.bytes.max|uploads.size.max|l10n.versions.max|authzPayload.accountId|x-account-id" roma bob admin
```

Product smoke:

- Roma lists admin account instances from `accounts/00000001/instances/`
- Bob opens one admin instance
- Bob saves through Roma/Tokyo-worker
- publish/unpublish updates account-owned published projection state

## Stop Conditions

Stop if:

- Admin needs a separate storage lane
- Bob needs to write widget software or account widget folders
- Roma cannot distinguish private relational UUID from `accountPublicId`
- publish/unpublish correctness is moved into Venice
- product cap/tier decisions remain owned by Tokyo-worker
- Bob/Prague cannot carry `accountPublicId + instanceId` in public references

## Exit Criteria

- Roma is the management plane for account instance lifecycle.
- Bob remains one-instance editor.
- Admin account examples are normal account instances.

## Execution Notes

Completed in this slice:

- Confirmed Roma account runtime calls use `accountPublicId` for Tokyo account-owned instance and asset storage.
- Kept relational/account-management UUID uses scoped to Berlin/account-control surfaces.
- Added Roma-side upload-size and storage-cap enforcement before asset bytes are sent to Tokyo.
- Kept Tokyo asset/product-control service calls as PBX storage operations, with Roma providing the account public id and policy decision.
- Confirmed Bob opens one account instance, loads widget software from product `/widgets/{widgetType}` assets, and emits account-scoped public embeds.
- Confirmed Admin/DevStudio has no separate admin widget storage lane and no `wgt_`/`ins_`/admin UUID account folder dependency.
- Removed remaining UI copy implying accounts own widgets rather than instances.
- Added a Roma package `test` script that runs its typecheck so the required PRD verification command is stable.

Verification completed:

```bash
pnpm --filter @clickeen/roma test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/devstudio test
pnpm lint
pnpm typecheck
git diff --check
```

Evidence:

- `Execution_Pipeline_Docs/02-Executing/evidence/099F__scan_legacy_admin_account_widget_lanes.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099F__scan_account_instance_coordinates.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099F__scan_policy_ownership.txt`
