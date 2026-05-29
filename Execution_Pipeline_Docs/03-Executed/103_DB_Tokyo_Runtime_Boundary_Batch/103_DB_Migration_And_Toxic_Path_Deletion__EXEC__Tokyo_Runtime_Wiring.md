# EXEC 103_DB.8 Migration And Toxic Path Deletion

Status: Executed historical evidence / green runtime slice; surviving doctrine extracted to PRD 105C; superseded by PRD 105, 105A, 105B, and 105C where conflicting
Date Started: 2026-05-22
Date Completed: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.8 - Migration and toxic-path deletion`

Archive note: this document is no longer active execution authority. It is retained as evidence for legacy R2 source-mirror deletion. PRD 105 supersedes this document where generated file naming or locale artifact shape conflicts.

## Slice Intent

This slice deletes the remaining active product paths that treated old R2 JSON files as product coordination state.

The approved V1 model after this slice is:

- `instances` owns registry/control state, including publish state and coarse translation state;
- `instance.config.json` is a private Tokyo payload for non-text settings, identity/display metadata, widget type/code, and timestamps; account locale settings own base locale and selected target locales;
- `instance.content.json` is a private Tokyo payload for base editable text, translated field values, and changed/ok translation pickup status;
- `instance.json` is not written or read by active runtime code;
- `instances/index.json` is not product truth and is not read by active runtime code;
- public browser files are materialized output only.

## Runtime Changes

- Removed the active `instance.json` key helper from Tokyo render storage keys.
- Removed `instance.json` normalization and saved-pointer normalization from the runtime normalizer.
- Removed fallback reads from `instance.json` when opening composed instance source.
- Removed fallback reads from `instance.json` when creating content payloads.
- Removed all `instance.json` writes from save and rename.
- Removed `publishStatus` from `instance.config.json`; publish status now comes from `instances.publish_status`.
- Updated saved pointer/list summary construction so publish status is read from the DB-backed registry location, not from payload JSON.
- Kept generated public stable aliases (`styles.css`, `script.js`, and `script.{locale}.js`) as materialized browser output.

## Guard Changes

`scripts/verify/prd103-db-pivot-guard.mjs` now scans active Tokyo render runtime code and fails if these deleted helpers return:

- `accountInstanceDocumentKey`
- `normalizeAccountInstanceDocument`
- `normalizeSavedRenderPointer`

Tests also assert:

- save does not write `instance.json`;
- publish does not need `instance.json`;
- rename updates `instance.config.json` and does not write `instance.json`;
- product instance listing ignores stray old `instance.json` files.

## Migration Readout

Current cloud-dev/admin instances were already seeded into the DB `instances` registry in slice 103_DB.3:

- FAQ: `UZ3JEJSHII`
- Countdown: `H7IF9M2K9B`
- Logo Showcase: `8FMVZFFPJV`

This slice did not mutate remote R2 or Supabase from the agent terminal. Physical old files may still exist until a later cleanup job deletes cold storage residue, but they no longer participate in active product runtime behavior.

## Verification

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm verify:prd103-db-pivot`

Current targeted proof:

- Tokyo render tests pass with `instance.json` writes/fallbacks removed.
- Tokyo typecheck passes with `publishStatus` removed from `instance.config.json`.
- DB pivot guard blocks the deleted runtime helpers from returning.

## Green Readout

The toxic source-mirror path is deleted from active runtime code:

- DB registry/control rows own product state.
- Tokyo private payload files hold only payload.
- Old object mirrors are not supported product modes.
- Public serving still reads only materialized generated browser artifacts from R2/CDN.
