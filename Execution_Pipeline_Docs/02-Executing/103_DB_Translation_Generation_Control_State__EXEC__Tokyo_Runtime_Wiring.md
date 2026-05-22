# EXEC 103_DB.5 Translation Generation Control State

Status: Green
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.5 - Translation generation control state`

## Slice Intent

Generate must have deterministic product state. Bob/Roma may ask Tokyo for generation state, but they must not infer correctness from a browser spinner, translated-locale polling alone, storage objects, or San Francisco telemetry.

The approved V1 DB primitive is `instances.translation_status` with `idle`, `queued`, `running`, and `failed`. No job table, sourceVersion, generation lane, error column, or per-locale progress column is approved for this slice.

## Current Finding

Tokyo already has a private current generation document that carries the exact job basis needed for duplicate suppression and stale completion rejection. That mechanism must not become a product API, and it must not be read by Roma/Bob/San Francisco directly.

The missing DB pivot work is that `instances.translation_status` exists but is not written by the Generate/complete/fail path. Therefore the product has a DB control column that is not yet the product-visible coarse state.

## Implementation Direction

- Tokyo writes `instances.translation_status = queued` when a Generate request creates or returns active work.
- Tokyo writes `instances.translation_status = idle` when Generate has nothing to queue or when the accepted target locales are ready.
- Tokyo writes `instances.translation_status = failed` when queue send or terminal locale failure makes the current generation failed.
- Tokyo reads `instances.translation_status` when returning the generation summary so Roma/Bob receive DB-backed coarse state.
- Tokyo keeps private job basis comparison only as an implementation guard for dedupe and stale completion rejection. This is not a public product state object.

## Implementation Completed

- Tokyo Generate writes `instances.translation_status = queued` when it creates a current generation.
- Tokyo Generate returns an active matching generation without duplicate queue sends and keeps the registry row `queued`.
- Tokyo Generate writes `instances.translation_status = idle` when there is no target work to queue.
- Tokyo writes `instances.translation_status = running` after a partial locale completion and `idle` after accepted target locales complete.
- Tokyo writes `instances.translation_status = failed` when queue send fails or the current generation records a terminal locale failure.
- Tokyo generation reads merge the DB-backed coarse status into the generation summary returned to Roma/Bob.
- Private generation basis remains a Tokyo implementation guard for duplicate suppression and stale completion rejection. It is not exposed as a product API, and no job table/sourceVersion/generation lane was added.

## Verification

- `pnpm --filter @clickeen/tokyo-worker test` - green, 38 tests.
- `pnpm --filter @clickeen/tokyo-worker typecheck` - green.

## Green Readout

Generate now has one coarse product-visible control state in Supabase: `instances.translation_status`.

The product path still uses Tokyo operations for the real work:

- Bob/Roma asks Tokyo to Generate.
- Tokyo computes missing/changed fields from the approved saved text/content payload.
- Tokyo queues locale translation work.
- San Francisco completion reports back through Tokyo completion/failure operations.
- Tokyo updates translated values and the registry control row.

No new product table, status object, sourceVersion check, or browser-owned inference was introduced in this slice.
