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

- Tokyo writes `instances.translation_status = queued` when a Generate request creates current work.
- Tokyo writes `instances.translation_status = idle` when Generate has nothing to queue or when the accepted target locales are ready.
- Tokyo writes `instances.translation_status = failed` when queue send or terminal locale failure makes the current generation failed.
- Tokyo reads detailed current generation state as the authoritative job truth; `instances.translation_status` remains a coarse product control projection and must not turn terminal or idle generation state back into active polling.
- Tokyo fails stale active generations that do not receive San Francisco completion/failure callbacks before the backend timeout.
- Tokyo keeps private job basis comparison only as an implementation guard for dedupe and stale completion rejection. This is not a public product state object.

## Implementation Completed

- Tokyo Generate writes `instances.translation_status = queued` when it creates a current generation.
- Tokyo Generate treats an explicit user click as fresh intent: it creates a new current generation, enqueues the missing/changed target locales again, and supersedes the prior active generation. Late completions from the prior generation are ignored by the existing job-id guard.
- Tokyo Generate writes `instances.translation_status = idle` when there is no target work to queue.
- Tokyo writes `instances.translation_status = running` after a partial locale completion and `idle` after accepted target locales complete.
- Tokyo writes `instances.translation_status = failed` when queue send fails or the current generation records a terminal locale failure.
- Tokyo generation reads preserve detailed generation truth over stale DB projection. A stale `instances.translation_status = queued` cannot make a completed, failed, superseded, or idle generation appear active again.
- Tokyo generation reads fail stale active generations after the backend liveness cutoff, so Bob cannot poll a lost queue/callback forever.
- Private generation basis remains a Tokyo implementation guard for duplicate suppression and stale completion rejection. It is not exposed as a product API, and no job table/sourceVersion/generation lane was added.
- Cloud-dev worker deploy detection now redeploys both Tokyo and San Francisco when shared translation/runtime packages change (`ck-contracts`, `ck-policy`, `l10n`) so producer and consumer contracts do not drift.

## Verification

- `pnpm -C tokyo-worker test` - green, 42 tests.
- `pnpm -C tokyo-worker typecheck` - green.
- `pnpm -C sanfrancisco test` - green, 12 tests.
- `pnpm -C sanfrancisco typecheck` - green.

## Green Readout

Generate now has one coarse product-visible control state in Supabase: `instances.translation_status`.

Detailed generation state remains Tokyo-owned. The registry projection helps the product list/control state, but cannot override terminal generation truth. Lost queue work, missing consumers, or failed callbacks must become explicit generation failure instead of an endless Roma/Bob spinner.

The product path still uses Tokyo operations for the real work:

- Bob/Roma asks Tokyo to Generate.
- Tokyo computes missing/changed fields from the approved saved text/content payload.
- Tokyo queues locale translation work.
- San Francisco completion reports back through Tokyo completion/failure operations.
- Tokyo updates translated values and the registry control row.

No new product table, status object, sourceVersion check, or browser-owned inference was introduced in this slice.

## Errata - Generic Translation Closure On 2026-05-25

This slice remains the DB Pivot control-state slice. It proves the coarse `instances.translation_status` projection and Tokyo-owned generation state mechanics; it does not by itself close the end-to-end product smoke gate.

The earlier FAQ-specific runtime gap has now been corrected by PRD 103J local implementation:

- Tokyo generation and completion use generic `editable-fields.json` contracts instead of a FAQ-only gate.
- San Francisco consumes generic saved text fields instead of FAQ saved-text graph fields.
- The queue job contract is `InstanceTranslationJob` v2 with `widgetType`, `widgetContract`, `changedFields`, `deletedIdentityKeys`, and identity-bearing job basis.
- Bob no longer exposes queue/readiness internals such as `Queued 0 of N`, and disables Generate for widgets without translation fields.
- Widget registration now uses a generated Tokyo-worker source index guarded by `pnpm validate:widgets`; adding a widget no longer requires hand-editing the translation runtime.

Additional local proof added after this errata:

- `pnpm -C tokyo-worker test` proves FAQ, Countdown, and Logo Showcase use the same generic Generate/complete path where applicable, including Logo Showcase nested repeated fields.
- `pnpm verify:prd103-publish-language-files` proves FAQ, Countdown, and Logo Showcase translated public artifacts are materialized from Tokyo source and current translated values under the DB-backed instance registry.
- `pnpm -C bob test` proves Generate is disabled for widgets without translatable fields and generation copy comes from Tokyo job state.
- `node scripts/verify/prd103j-generic-translation-guard.mjs` blocks FAQ graph imports/gates from returning to Tokyo/San Francisco product translation modules.

The remaining DB.9 blocker is authenticated cloud-dev product smoke, not FAQ-only runtime architecture.
