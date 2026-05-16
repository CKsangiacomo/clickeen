# PRD 099C - Account Runtime Storage Contract

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 3 of 8

## Purpose

Hard-cut account runtime storage to account-first instance paths.

Accounts have instances and assets. Accounts do not have widgets.

## Surviving Account Tree

```text
accounts/{accountPublicId}/
  assets/
  instances/
    index.json
    {instanceId}/
      instance.json
      config.json
      publish.json
      overlays/
        {overlayId}.json
      selected-overlays/
        {languageCode}/{experiment}/{personalization}.json
      published/
        live/
          r.json
        config.json
        overlays/
          {overlayId}.json
        seo/
          meta/
            live/{locale}.json
            {locale}/{metaFp}.json
```

`accountPublicId` is exactly:

```text
^[0-9A-Z]{8}$
```

The admin account is:

```text
00000001
```

## Scope

In scope:

- replace `accounts/{accountId}/widgets/**` as live product storage
- replace UUID account path names with `accountPublicId`
- preserve PRD 098 overlay identity and body shape while moving physical overlay objects under the instance
- store published projections under the account instance
- name every published projection file Venice may read
- define generated index behavior under `accounts/{accountPublicId}/instances/index.json`
- convert account asset R2 paths to `accountPublicId`

Out of scope:

- Venice route shape implementation
- final R2 stale-root deletion
- new free/paid account business model

## Blast Radius

Likely touched:

- `tokyo-worker/src/domains/render/keys.ts`
- `tokyo-worker/src/domains/render/saved-config.ts`
- `tokyo-worker/src/domains/render/instance-index.ts`
- `tokyo-worker/src/domains/render/overlays.ts`
- `tokyo-worker/src/domains/render/live-surface.ts`
- `tokyo-worker/src/domains/assets.ts`
- `tokyo-worker/src/domains/assets-handlers.ts`
- `packages/ck-contracts/src/index.ts`
- `roma/lib/account-assets-gateway.ts`
- tests around render keys, overlays, asset keys, and instance index

Known old patterns:

```text
accounts/{accountId}/widgets
accounts/{uuid}/...
accounts/{uuid}/instances/wgt_*
accounts/{uuid}/widgets/**/ins_*
published/widgets/{instanceId}.json
```

## Required Work

1. Centralize PRD99 storage key builders.
2. Make account instance key builders emit only `accounts/{accountPublicId}/instances/{instanceId}/...`.
3. Move selected overlay and overlay object storage under the owning instance.
4. Move published projection keys under `accounts/{accountPublicId}/instances/{instanceId}/published/`.
5. Ensure account assets use `accounts/{accountPublicId}/assets/`.
6. Ensure account asset public/serve URLs carry `accountPublicId` when account coordinate is needed. Private UUIDs remain Berlin/Michael relational implementation only.
7. Ensure `instance.json` carries `widgetType` and/or `widgetCode`; widget identity must not be inferred from a folder.
8. State that `widgetCode` is metadata/codebook identity only; it is never required to locate an instance in R2 storage.
9. Update tests to fail on old account-widget paths.

## Verification

Required scans:

```bash
rg -n "accounts/.*/widgets|published/widgets|accounts/[0-9a-f-]{36}|wgt_|ins_" tokyo-worker roma bob venice prague admin scripts packages
rg -n "accounts/.*/instances|accounts/.*/assets|overlays/.+overlayId|selected-overlays" tokyo-worker packages roma
rg -n "accountAsset.*UUID|isUuid|/assets/account/.+accountId" packages tokyo-worker roma venice
```

The first scan must have no active product-path matches. Test fixtures may mention old paths only as explicitly rejected cases.

## Stop Conditions

Stop if:

- any active path still needs `accounts/{accountPublicId}/widgets/`
- UUID account IDs are required as R2 folder names
- `wgt_*` or `ins_*` must remain live storage identity
- overlay bodies need extra metadata to compensate for unclear storage paths
- published projection cannot move under the account instance without a root lookup authority decision
- account asset contracts still require UUID account IDs in R2 paths or public asset URLs
- `widgetCode` is needed to locate instance storage

## Exit Criteria

- Account runtime storage contract is represented by one set of shared key builders.
- Admin instances are modeled as `accounts/00000001/instances/{instanceId}/`.
- `099D`, `099E`, and `099F` can implement routes and product flows against this account contract.

## Execution Notes

Completed in this slice:

- Account instance key builders now emit `accounts/{accountPublicId}/instances/index.json` and `accounts/{accountPublicId}/instances/{instanceId}/...`.
- Account instance roots ignore `widgetCode` for location; `widgetCode` remains metadata/codebook identity only.
- Published config and SEO/GEO packs live under the account instance `published/` subtree.
- Account asset public paths and R2 blob keys now require `accountPublicId` for the account segment and UUID only for `assetId`.
- Roma asset gateway and account storage usage now send `accountPublicId` to Tokyo asset control.
- Tokyo asset control routes now accept compact account public IDs, not UUID account IDs.
- Tokyo asset authorization compares Roma auth capsules against `accountPublicId`.
- Venice no longer displays old `ins_...` guidance in the live embed loader.
- Added Tokyo Worker bundled contract tests for account asset public ID paths and UUID-account rejection.

Verification evidence:

- `Execution_Pipeline_Docs/02-Executing/evidence/099C__scan_legacy_account_runtime_paths.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099C__scan_canonical_account_runtime_paths.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099C__scan_asset_account_identity_contract.txt`

Legacy scan classification:

- `tokyo-worker/src/route-helpers.test.ts` contains `ins_legacy_instance` only as an explicit rejection fixture.

Green checks:

- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/venice typecheck`
- `pnpm lint`
- `pnpm typecheck`
