# PRD 088 Execution Report

Status: GREEN / EXECUTED  
Started: 2026-05-10  
Completed: 2026-05-10  
Scope: Tokyo account widget instance storage hard cut

## Slice 0: Inventory And Freeze

Status: GREEN

Slice 0 is read-only. It inventories the live Tokyo R2 state and code blast radius, chooses final stable instance IDs, names every old prefix to delete, and defines the migration script contract before any runtime code is changed.

### Live R2 Bucket

Bucket:

```txt
tokyo-assets-dev
```

Wrangler bucket info:

```txt
object_count: 1639
bucket_size: 4.76 MB
```

Verified account:

```txt
00000000-0000-0000-0000-000000000100
```

This is the Clickeen admin account. It must be treated as a normal account with broader permissions, not as a special storage lane.

### Current Admin Instance Inventory

Source object:

```txt
accounts/00000000-0000-0000-0000-000000000100/instances/index.json
```

Current index contains 9 instances.

| Old ID | Widget type | Display name | Publish status | Updated at |
| --- | --- | --- | --- | --- |
| `wgt_main_countdown` | `countdown` | `wgt_main_countdown` | `published` | `2026-04-27T16:01:54.928Z` |
| `wgt_curated_faq_photo_hospitality_westcoast` | `faq` | `photo.hospitality.westcoast` | `published` | `2026-04-28T05:40:25.169Z` |
| `wgt_curated_faq_lightblurs_generic` | `faq` | `lightblurs.generic` | `published` | `2026-04-28T05:38:05.005Z` |
| `wgt_curated_faq_photo_museum_art` | `faq` | `wgt_curated_faq_photo_museum_art` | `published` | `2026-04-27T16:03:12.399Z` |
| `wgt_curated_faq_minimal_whitegreen_museum` | `faq` | `wgt_curated_faq_minimal_whitegreen_museum` | `published` | `2026-04-27T16:02:55.509Z` |
| `wgt_curated_faq_photo_restaurant_highend` | `faq` | `wgt_curated_faq_photo_restaurant_highend` | `published` | `2026-04-27T16:02:41.585Z` |
| `wgt_curated_faq_minimal_techpalette` | `faq` | `wgt_curated_faq_minimal_techpalette` | `published` | `2026-04-27T16:02:25.823Z` |
| `wgt_main_faq` | `faq` | `wgt_main_faq` | `published` | `2026-04-27T16:01:10.921Z` |
| `wgt_main_logoshowcase` | `logoshowcase` | `wgt_main_logoshowcase` | `published` | `2026-04-27T16:01:41.366Z` |

For each old ID, these old objects were verified present:

```txt
accounts/{admin}/instances/{oldId}/saved/pointer.json
accounts/{admin}/instances/{oldId}/render/live/pointer.json
accounts/{admin}/instances/{oldId}/l10n/index.json
public/instances/{oldId}/live.json
```

Current `listed-index.json` exists but has no listed entries:

```txt
accounts/00000000-0000-0000-0000-000000000100/instances/listed-index.json
entries: []
```

### Current L10n Drift Found

The FAQ instances report many ready locales in their render live pointers, but their account l10n index currently exposes only `en` under `overlays`.

Example shape:

```txt
readyLocales: ["en", "ar", "bn", "cs", "da", "de", "es", "fi", ...]
overlayLocales: ["en"]
```

This is recorded as existing drift. PRD 088 must move the current account-instance l10n artifact to `overlays/l10n/{locale}/overlay.json`; it must not preserve a split where readiness and actual overlay files disagree.

### Final Instance ID Map

Every surviving admin-owned instance gets a stable generated `ins_*` ID. These IDs replace both old storage IDs and public/embed IDs.

| Old ID | Final instance ID | Widget type |
| --- | --- | --- |
| `wgt_main_countdown` | `ins_01KR8R6ZYTPM6B3CHS8KZ0CEC9` | `countdown` |
| `wgt_curated_faq_photo_hospitality_westcoast` | `ins_01KR8R6ZYZBDXE0DT2FB8PB0NN` | `faq` |
| `wgt_curated_faq_lightblurs_generic` | `ins_01KR8R6ZYZZNDEZA0R8KCSWEEG` | `faq` |
| `wgt_curated_faq_photo_museum_art` | `ins_01KR8R6ZYZWXEWPYHVBWVD4PPZ` | `faq` |
| `wgt_curated_faq_minimal_whitegreen_museum` | `ins_01KR8R6ZZ0SXP6MSSHRNV0S52R` | `faq` |
| `wgt_curated_faq_photo_restaurant_highend` | `ins_01KR8R6ZZ0M5RN6CVDR0X5G6DR` | `faq` |
| `wgt_curated_faq_minimal_techpalette` | `ins_01KR8R6ZZ0F8CKMC45CXEB5BKX` | `faq` |
| `wgt_main_faq` | `ins_01KR8R6ZZ0TXQMJQ3VPS9WM2QJ` | `faq` |
| `wgt_main_logoshowcase` | `ins_01KR8R6ZZ07S5PMJVSRKM4M7K8` | `logoshowcase` |

### Prague Embed Rewrite Map

Prague embeds Clickeen-owned account instances. It must reference the same final `ins_*` IDs as every other public embed.

| Prague current reference | Current admin source ID | Final instance ID |
| --- | --- | --- |
| `wgt_main_countdown` | `wgt_main_countdown` | `ins_01KR8R6ZYTPM6B3CHS8KZ0CEC9` |
| `wgt_system_faq_photo_hospitality_westcoast` | `wgt_curated_faq_photo_hospitality_westcoast` | `ins_01KR8R6ZYZBDXE0DT2FB8PB0NN` |
| `wgt_system_faq_lightblurs_generic` | `wgt_curated_faq_lightblurs_generic` | `ins_01KR8R6ZYZZNDEZA0R8KCSWEEG` |
| `wgt_system_faq_minimal_whitegreen_museum` | `wgt_curated_faq_minimal_whitegreen_museum` | `ins_01KR8R6ZZ0SXP6MSSHRNV0S52R` |
| `wgt_main_logoshowcase` | `wgt_main_logoshowcase` | `ins_01KR8R6ZZ07S5PMJVSRKM4M7K8` |

Prague files with current embed references:

```txt
tokyo/prague/pages/countdown/overview.json
tokyo/prague/pages/faq/examples.json
tokyo/prague/pages/faq/features.json
tokyo/prague/pages/faq/overview.json
tokyo/prague/pages/faq/pricing.json
tokyo/prague/pages/logoshowcase/overview.json
```

### Code Blast Radius

`publicId` is still widespread and must be removed from active product contracts during the atomic cut.

| Area | `publicId` hits |
| --- | ---: |
| `tokyo-worker` | 376 |
| `roma` | 284 |
| `bob` | 77 |
| `venice` | 49 |
| `prague` | 85 |
| `berlin` | 23 |
| `packages` | 0 |
| `documentation` | 208 |

This confirms Slices 1, 2, and 3 must remain atomic. A partial deploy would preserve two product identities.

### Delete Prefixes

The migration must delete these old R2 prefixes after target writes are verified.

Per old ID:

```txt
accounts/00000000-0000-0000-0000-000000000100/instances/{oldId}/
public/instances/{oldId}/
l10n/instances/{oldId}/
l10n/v/{buildId}/instances/{oldId}/
```

Admin index objects:

```txt
accounts/00000000-0000-0000-0000-000000000100/instances/index.json
accounts/00000000-0000-0000-0000-000000000100/instances/listed-index.json
```

The migration script must list before delete. If a listed prefix has no objects, it reports `0` and continues. If it finds an unexpected object shape under an old instance prefix, it blocks instead of deleting.

### Target Writes

For each widget type:

```txt
accounts/{admin}/widgets/{widgetType}/widget.json
```

For each instance:

```txt
accounts/{admin}/widgets/{widgetType}/{instanceId}/instance.json
accounts/{admin}/widgets/{widgetType}/{instanceId}/config.json
accounts/{admin}/widgets/{widgetType}/{instanceId}/publish.json
published/widgets/{instanceId}.json
```

For each active account-instance locale overlay:

```txt
accounts/{admin}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/overlay.json
```

The base locale must not be fabricated as a translated overlay. If the only verified current overlay is `en`, the migration report must say so and not invent missing locale files.

### Migration Script Spec

Script target:

```txt
scripts/tokyo/prd88-account-storage-migrate.mjs
```

Inputs:

```txt
--bucket tokyo-assets-dev
--account 00000000-0000-0000-0000-000000000100
--mapping Execution_Pipeline_Docs/02-Executing/088__admin_instance_id_map.json
--dry-run
--apply
```

Default mode is `--dry-run`. Writes require `--apply`.

Required dry-run JSON output shape:

```json
{
  "v": 1,
  "prd": "088",
  "mode": "dry-run",
  "bucket": "tokyo-assets-dev",
  "accountId": "00000000-0000-0000-0000-000000000100",
  "generatedAt": "2026-05-10T00:00:00.000Z",
  "totals": {
    "instances": 9,
    "widgetTypes": 3,
    "plannedWrites": 0,
    "plannedDeletes": 0,
    "blockers": 0
  },
  "instances": [
    {
      "oldId": "wgt_curated_faq_lightblurs_generic",
      "newId": "ins_01KR8R6ZYZZNDEZA0R8KCSWEEG",
      "widgetType": "faq",
      "displayName": "lightblurs.generic",
      "sourceKeys": [],
      "targetKeys": [],
      "deletePrefixes": [],
      "warnings": []
    }
  ],
  "pragueRewrites": [],
  "writes": [],
  "deletes": [],
  "blockers": []
}
```

Required behavior:

1. Build live R2 inventory from object listing, not from hand-coded assumptions.
2. Read old saved pointer, live pointer, l10n index, and public live object for each old ID.
3. Write readable target source files: `widget.json`, `instance.json`, `config.json`, `publish.json`, and account-instance l10n overlays.
4. Write only tiny generated public lookup cards under `published/widgets/`.
5. Rewrite Prague page JSON references to final `ins_*` IDs.
6. Be idempotent: identical target files are reported as `skippedIdentical`.
7. Refuse mismatched existing target files and report a blocker.
8. Refuse to delete old prefixes until target reads verify.
9. Delete old prefixes only in `--apply`.
10. Produce before/after object counts in both dry-run and apply reports.

### Slice 0 Exit Criteria

| Criterion | Status |
| --- | --- |
| Exact before table checked into execution report | GREEN |
| Every surviving admin-owned instance has a chosen final `ins_*` ID | GREEN |
| Every delete target has an explicit object prefix | GREEN |
| Migration script spec written before code execution | GREEN |
| Migration script dry-run output shape defined | GREEN |

Slice 0 is complete. Slices 1, 2, and 3 must execute as one atomic hard cut.

## Slices 1-3: Atomic Storage, Data, And Route Cutover

Status: GREEN

Slices 1, 2, and 3 were executed as one hard-cut unit. Product runtime now uses `instanceId` and the account/widget/instance path shape. The only reader of old `accounts/{account}/instances` and `public/instances` was the PRD 088 migration script.

### Slice 1: Contract Types And Key Builders

Code changes:

- Tokyo key builders now write account-owned widget state under `accounts/{accountId}/widgets/{widgetType}/{instanceId}/...`.
- Tokyo writes `widget.json`, `instance.json`, `config.json`, `publish.json`, `published/config.json`, and `overlays/l10n/{locale}/overlay.json`.
- Tokyo public lookup is now `published/widgets/{instanceId}.json`.
- Tokyo public render routes use `/renders/widgets/{instanceId}/...`; old `/renders/instances/...` routes were deleted.
- Tokyo l10n read routes use `/l10n/widgets/{instanceId}/index.json` and `/l10n/widgets/{instanceId}/{locale}/overlay.json`.
- Roma/Bob/Venice/Prague active contracts were renamed from `publicId` to `instanceId`.
- Venice public shell route is `/widget/{instanceId}`. Old `/e/{id}`, `/r/{id}`, and `/api/instance/{id}` routes were deleted.
- Berlin projection naming was replaced with publish-containment naming so old "projection as truth" language is not preserved in the active route layer.

Verification:

```txt
corepack pnpm --filter @clickeen/tokyo-worker exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/roma exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/bob exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/venice exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/berlin exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/prague typecheck
corepack pnpm --filter @clickeen/prague build
```

All checks were green before Slice 2 data deletion.

### Slice 2: Admin Account R2 Migration

Migration script:

```txt
scripts/tokyo/prd88-account-storage-migrate.mjs
```

Supported modes:

```txt
default dry-run
--write / --apply
--verify-only
--delete-old
```

The script:

1. reads the old admin index and old per-instance saved/render/l10n objects
2. writes the new account-owned widget/instance objects
3. verifies target object contents by re-reading R2
4. deletes old keys only after target verification passes

Dry-run result:

```txt
planned writes: 270
planned deletes: 868
```

Write result:

```txt
wrote and verified 270 objects
```

Delete result:

```txt
deleted 868 old objects after target verification
```

Final report:

```txt
Execution_Pipeline_Docs/03-Executed/088__r2_migration_report.json
mode: delete-old
verified: true
oldDeleted: true
```

Post-migration spot checks:

```txt
FOUND  published/widgets/ins_01KR8R6ZYZZNDEZA0R8KCSWEEG.json
FOUND  accounts/00000000-0000-0000-0000-000000000100/widgets/faq/ins_01KR8R6ZYZZNDEZA0R8KCSWEEG/overlays/l10n/es/overlay.json
GONE   public/instances/wgt_curated_faq_lightblurs_generic/live.json
GONE   accounts/00000000-0000-0000-0000-000000000100/instances/wgt_curated_faq_lightblurs_generic/saved/pointer.json
```

The new lookup card is small and contains only routing metadata:

```json
{
  "v": 1,
  "id": "ins_01KR8R6ZYZZNDEZA0R8KCSWEEG",
  "accountId": "00000000-0000-0000-0000-000000000100",
  "widgetType": "faq",
  "status": "published",
  "updatedAt": "2026-05-10T12:45:17.592Z"
}
```

The new Spanish l10n artifact is under the owning instance:

```txt
accounts/{admin}/widgets/faq/ins_01KR8R6ZYZZNDEZA0R8KCSWEEG/overlays/l10n/es/overlay.json
```

It has `type: "l10n"`, `status: "ready"`, a base fingerprint, and the translated text pack.

### Slice 3: Publish And Venice Route Cutover

Runtime route shape:

```txt
/widget/{instanceId}
/renders/widgets/{instanceId}/live/r.json
/renders/widgets/{instanceId}/config.json
/l10n/widgets/{instanceId}/index.json
/l10n/widgets/{instanceId}/{locale}/overlay.json
```

Deleted active product routes:

```txt
venice/app/e/[publicId]/route.ts
venice/app/r/[publicId]/route.ts
venice/app/api/instance/[publicId]/route.ts
```

Prague page JSON now references `ins_*` instance IDs for the current Clickeen-owned embeds.

Slice 3 is green because public serving has one lookup card plus account-owned source, not a copied `public/instances` tree.

## Slice 5: Cleanup Docs And Dead Names

Status: GREEN

Slice 5 removed stale product names and dead execution paths left behind by the storage cut. This was not cosmetic cleanup; the goal was to keep active code and active docs from re-teaching old product concepts.

Deleted code and scripts:

```txt
scripts/dev/seed-local-platform-state.mjs
scripts/dev/seed-local-platform-assets.mjs
scripts/dev/rebuild-tokyo-instance-indexes.mjs
scripts/tokyo/prd88-account-storage-migrate.mjs
venice/scripts/check-budgets.js
```

The PRD 088 migration runner was intentionally deleted after the live R2 migration succeeded and the immutable migration report was written. Product runtime must not keep a runnable old-shape reader around.

Renamed or removed active product words:

```txt
systemInstanceRef -> accountInstanceRef
publicId -> instanceId
public projection -> published lookup
account instance translations -> account instance l10n overlay
Prague translations -> Prague page translations
```

Docs rewritten or corrected:

```txt
documentation/architecture/CONTEXT.md
documentation/architecture/OverlayArchitecture.md
documentation/architecture/BabelProtocol.md
documentation/architecture/RuntimeProfiles.md
documentation/services/tokyo.md
documentation/services/tokyo-worker.md
documentation/services/venice.md
documentation/services/michael.md
documentation/services/berlin.md
documentation/services/devstudio.md
prague/README.md
venice/README.md
```

The surviving language is now:

```txt
account
widget type
instance
instanceId
asset
account instance overlay
l10n
Prague page translation
publish
published lookup
```

## Final Verification

Runtime stale-name scan:

```txt
rg -n "publicId|public_id|/renders/instances|/l10n/instances|public/instances|CK_PLATFORM_ACCOUNT_ID|wgt_curated|wgt_system|systemInstanceRef|systemInstance" tokyo-worker roma bob prague venice packages/ck-contracts/src scripts package.json tokyo/prague/pages tokyo/prague/l10n --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/.astro/**'
```

Result:

```txt
no matches
```

Compiler and build checks:

```txt
corepack pnpm --filter @clickeen/tokyo-worker exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/roma exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/bob exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/venice exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/berlin exec tsc -p tsconfig.json --noEmit
corepack pnpm --filter @clickeen/prague typecheck
corepack pnpm --filter @clickeen/prague build
corepack pnpm --filter @clickeen/venice build
PATH="/tmp/clickeen-bin:$PATH" corepack pnpm lint
PATH="/tmp/clickeen-bin:$PATH" corepack pnpm typecheck
```

Result:

```txt
all green
```

Notes:

- `@clickeen/tokyo-worker` has no package `build` script; its executable check is the direct TypeScript check above.
- Root Turbo needed a temporary local `pnpm` wrapper because this machine has Corepack available but no global `/usr/local/bin/pnpm` shim. That changes no repo files.

R2 migration result:

```txt
Execution_Pipeline_Docs/03-Executed/088__r2_migration_report.json
mode: delete-old
verified: true
oldDeleted: true
```

PRD 088 is complete. Downgrade enforcement remains intentionally out of scope for this PRD and belongs to the follow-up product enforcement slice named in the PRD.
