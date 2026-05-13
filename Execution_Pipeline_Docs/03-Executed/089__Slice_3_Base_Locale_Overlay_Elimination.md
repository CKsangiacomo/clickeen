# PRD 089 Slice 3 - Base Locale Overlay Elimination

Status: Executed - runtime green; bespoke audit script removed by Slice 10
Date: 2026-05-11

## Changes

`tokyo-worker/src/domains/account-instance-sync.ts` now skips `upsertL10nOverlay` when `locale === baseLocale`.

`tokyo-worker/src/domains/l10n-read.ts` now:

- loads the published account instance base locale from `instance.json`,
- excludes stale base-locale overlay objects from `/l10n/widgets/{instanceId}/index.json`,
- returns 404 for direct reads of `/l10n/widgets/{instanceId}/{baseLocale}/overlay.json`.

Slice 10 removed the bespoke `scripts/tokyo/prd89-base-locale-overlays.mjs` helper. It depended on explicit inventory input and a source-text self-test, so it is not closure-grade proof.

## Verification

```bash
node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Result: passed.

```bash
corepack pnpm --filter @clickeen/tokyo-worker test
```

Result: passed. The package currently has no dedicated test script.

Known migrated instance audit:

Result:

```json
{
  "mode": "audit",
  "scannedKeyCount": 703,
  "overlayCount": 196,
  "staleBaseOverlayCount": 0,
  "missingInstanceDocumentCount": 0,
  "deleted": 0
}
```

Public Tokyo base-locale overlay spot audit for the 9 migrated `ins_*` instances returned 404 for each base-locale overlay read.

## Gate

Slice 3 is complete for known migrated state: no base-locale overlay residue was found in the PRD 088 migration key inventory, and the deployed public l10n route does not expose base-locale overlays for those migrated instances. This inventory evidence is not a substitute for authenticated product-path closure.
