# PRD 098C - Tokyo PBX Overlay Storage And Projection

Status: Executed  
Parent: `Execution_Pipeline_Docs/01-Planning/098__PRD__Overlay_Primitive_And_Locales_First_Application.md`  
Owner: DEV + TPM  
Sequence: 3 of 6  
Depends On: 098A and 098B green

## Core Tenet: PRD 098 Truth Is The Only Truth

Tokyo-worker must be refactored to the PRD 098 storage model as the only product truth. The existing handful of pre-GA records/objects are renamed, moved, recreated, or deleted. Tokyo must not keep old account/widget/instance/l10n paths alive as peers.

The old Tokyo product shape:

```text
accounts/{uuidAccountId}/widgets/{widgetType}/{ins_*}/...
overlays/l10n/{locale}/overlay.json
l10n/base/{fingerprint}.snapshot.json
published/widgets/{ins_*}.json
```

does not survive.

The surviving coordinate is:

```text
accounts/{accountPublicId}/widgets/{widgetCode}/{compactInstanceId}/...
overlays/{overlayId}.json
published projection -> overlayId
```

No dual reader, compatibility route, ID mapping helper, queue shim, text-pack reader, or old-path fallback is allowed. If a current cloud-dev object still needs the old path, move/recreate it under the new path or delete it.

## Purpose

Replace Tokyo-worker's old localization orchestration with PBX-style overlay storage.

Tokyo receives authenticated requests, validates storage contracts, writes/reads exact records, enforces policy caps, and returns results. Tokyo does not generate or translate language values.

## Product Outcome

Save and publish stop depending on a confused Tokyo-localization state machine.

Tokyo becomes predictable:

- store base config
- store overlay object by `overlayId`
- store selected-overlay pointer
- publish projection with selected overlay IDs

No status truth. No queue truth. No body archaeology.

## Non-Negotiables

- Tokyo does not call San Francisco.
- Tokyo does not queue language generation.
- Tokyo does not inspect overlay values to classify overlay meaning.
- Tokyo does not write text packs.
- Tokyo does not compute base fingerprints.
- Tokyo does not maintain `readyLocales`.
- Tokyo does not create compatibility readers for old pre-GA l10n documents.
- Tokyo may allocate the next version slot as a storage operation; it must not treat version as semantic freshness.

## Surviving Authorities

| Concern | Authority |
| --- | --- |
| Base config | Tokyo account instance config |
| Overlay object | `overlays/{overlayId}.json` |
| Selected language overlay | Account-private selected-overlay pointer |
| Published runtime selection | Published projection |
| Translation generation | Roma + San Francisco, not Tokyo |

## Target Storage Contracts

Overlay object:

```text
overlays/{overlayId}.json
```

```json
{
  "v": 1,
  "values": {}
}
```

Selected-overlay pointer:

```text
accounts/{accountId}/widgets/{widgetCode}/{instanceId}/selected-overlays/{language}/{experiment}/{personalization}.json
```

```json
{
  "overlayId": "..."
}
```

Published projection includes overlay IDs:

```json
{
  "base": {},
  "overlays": {
    "languages": {
      "ITIT": "..."
    }
  }
}
```

Exact route names may follow existing Tokyo-worker private route style, but the product verbs must be:

- write complete language overlay values for one coordinate and return `overlayId`
- read selected overlay pointer by coordinate
- read overlay object by exact `overlayId`
- publish/sync projection using currently selected overlay IDs

Coordinate naming:

- `{accountId}` in this path means `accountPublicId` from 098A, not the private UUID.
- `{widgetCode}` is the 3-character widget codebook value, not `widgetType`.
- `{instanceId}` is the compact 10-character instance ID from 098A.
- `{language}`, `{experiment}`, and `{personalization}` are the exact overlay ID segments.
- Tokyo may store `widgetType` in documents for human/debug context, but storage coordinates use codebook values.

## New LOC Blast Radius

Expected new code is limited to:

- Tokyo overlay object key helpers
- selected-overlay pointer key helpers
- private PBX route handlers for exact overlay write/read
- version-slot allocation for one coordinate
- policy cap enforcement for retained versions
- published projection fields that point to overlay IDs
- tests for write/read/publish and version-slot refusal

New code must not include:

- a queue system
- a producer orchestration layer
- readiness/status state
- body scanning/classification logic
- a compatibility reader for old text packs
- a mutable overlay index

## Deletion LOC Blast Radius

Expected deletions/replacements include:

- Tokyo-owned San Francisco binding and generation call sites
- translation queue branches
- text pack writer/reader logic
- base snapshot and base fingerprint logic
- `readyLocales` and old l10n status fields on product render pointers
- old `/l10n/widgets/...` product routes when they only serve text-pack overlays

Delete l10n product logic in Tokyo; do not delete unrelated account locale policy reads needed by Roma/Berlin.

## Service Blast Radius

### `tokyo-worker`

Delete old l10n orchestration and replace only the storage verbs named in this PRD:

- `src/domains/l10n-authoring.ts`
- `src/domains/account-localization-state.ts`
- l10n branches in `src/domains/account-instance-sync.ts`
- old l10n branches in `src/domains/render/saved-config.ts`
- old l10n key helpers in `src/domains/render/keys.ts`
- old l10n types in `src/domains/render/types.ts`
- `writeTextPack` in `src/domains/render/packs.ts`
- `sync-instance-overlays` and `writeTextPack` queue branches
- San Francisco binding used only for Tokyo-owned generation
- old `routes/l10n-routes.ts` branches that serve text-pack overlays

Add:

- overlay object key helper
- selected-overlay key helper
- published projection overlay fields
- version-slot allocator per coordinate
- policy cap enforcement for `l10n.versions.max`
- referenced-overlay protection across selected pointers and published projections

### `roma`

Roma call sites that currently ask Tokyo to enqueue/sync translations must be changed in 098D. During 098C, remove or mark old Tokyo APIs unavailable behind compile errors rather than preserving them.

### `bob`

No direct dependency yet. Bob changes in 098E.

### `venice`

Projection shape changes must be compatible with 098F. Do not wire Venice in this slice unless needed for type tests.

### `sanfrancisco`

Tokyo must not depend on San Francisco bindings after this slice.

## Implementation Steps

1. Add Tokyo overlay storage key helpers.
2. Add Tokyo overlay object read/write functions that accept exact `overlayId`.
3. Add selected-overlay pointer read/write functions.
4. Add version-slot allocator for one coordinate:
   - account
   - widget
   - instance
   - language
   - experiment
   - personalization
5. Enforce `l10n.versions.max` per exact coordinate.
6. Reject overwriting a version slot if that `overlayId` is referenced by selected-overlay or published projection records.
7. Remove Tokyo-to-San Francisco generation code.
8. Remove old queue branches for translation and text pack writing.
9. Remove old l10n status fields from saved instance documents and render pointer types.
10. Update publish/sync to include selected overlay IDs in published projection.
11. Ensure publish does not wait for in-flight generation. It projects what exists at publish time.
12. Add a `test` script to `tokyo-worker/package.json` if absent, covering the new overlay storage/version behavior.

## UX And Product Notes

- Published widgets continue to serve base content until 098F wires overlay runtime.
- Bob should not see selectable translations until 098E.
- Save should not be blocked by Tokyo translation queues because those queues no longer exist.

## Policy Notes

`l10n.versions.max` remains the policy key for retained versions.

Retention applies per exact coordinate:

```text
account + widget + instance + language + experiment + personalization
```

Future experiment/personalization PRDs must account for this multiplication. PRD 098 writes `experiment=A01` and `personalization=000`.

## Documentation Updates Required

This slice is not done until these docs are updated or explicitly marked unchanged in the PR description with a reason:

- `documentation/services/tokyo-worker.md`
  - Rewrite Tokyo-worker responsibilities: Tokyo is PBX for overlay storage and projection.
  - Delete old statements that Tokyo owns l10n queues, `overlays/l10n/{locale}/overlay.json`, `readyLocales`, text packs, or base snapshots.
  - Document new overlay object, selected-overlay pointer, version-slot, and published projection storage contracts.
- `documentation/architecture/CONTEXT.md`
  - Update Tokyo Worker glossary and Product-Path Account Editing sections so translation generation is not Tokyo-owned.
  - Update generated artifact lists to remove l10n base snapshots/text packs as surviving product truth.
- `documentation/architecture/OverlayArchitecture.md`
  - Replace old l10n overlay path with `overlays/{overlayId}.json` and selected-overlay pointers.
  - State explicitly that no authoritative mutable overlay index ships in PRD 098.
- `documentation/architecture/BabelProtocol.md`
  - Update storage and execution sections: Tokyo stores exact overlay objects and selected pointers; Roma/San Francisco own generation.
- `documentation/services/tokyo.md`
  - Document public/private R2 path ownership changes if Tokyo static storage docs mention l10n paths.
- `documentation/capabilities/localization.md`
  - Document retained versions using `l10n.versions.max` per exact coordinate.
- `packages/ck-policy` policy docs if present in touched files
  - Ensure `l10n.versions.max` description says it caps retained overlay versions, not readiness/status.

## Verification Gates

This slice is not green until all pass:

```bash
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm typecheck
```

Required scans:

```bash
rg -n "generateAccountWidgetL10nOps|SANFRANCISCO_L10N|sync-instance-overlays|writeTextPack|L10nOp|textPack|baseFingerprint|readyLocales|generationId|l10nIntent" tokyo-worker
rg -n "overlays/l10n|l10n/base|/l10n/widgets" tokyo-worker
```

Expected:

- no Tokyo call to San Francisco
- no old text pack writes
- no old base fingerprint state
- no ready-locale status truth

## Stop Conditions

Stop immediately if:

- Tokyo needs to inspect overlay body to know the language/account/widget
- Tokyo introduces a generation status field as overlay truth
- old and new l10n readers coexist on the product path
- publish requires translation generation to finish

## Definition Of Done

- Tokyo is PBX for overlay storage.
- Overlay objects are stored by exact `overlayId`.
- Selected-overlay pointers point only to `overlayId`.
- Published projections carry selected overlay IDs.
- Old Tokyo localization orchestration is deleted, not wrapped.

## Execution Result

Executed in this workspace.

- Deleted Tokyo-worker's old San Francisco binding, translation sync routes, text-pack writer, base-snapshot/fingerprint state, ready-locale status, and old l10n route modules.
- Added exact overlay object storage, selected-overlay pointers, version-slot allocation, retained-version enforcement, and referenced-overlay overwrite protection.
- Updated publish/sync to project selected overlay IDs without waiting on generation.
- Removed Roma calls to the deleted Tokyo translation sync queue; 098D owns the new Roma/San Francisco Babel producer path.
- Updated Tokyo/Tokyo-worker/CONTEXT/localization policy docs to describe PBX storage/projection truth.

Green verification:

- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm typecheck`
- Required Tokyo-worker scans for old l10n orchestration returned no matches.
