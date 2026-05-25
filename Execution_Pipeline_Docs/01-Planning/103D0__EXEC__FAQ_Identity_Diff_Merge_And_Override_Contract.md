# PRD 103D.0 Execution - FAQ Identity, Diff, And Merge Contract

Status: Superseded by 103J / Legacy implementation deleted
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.1, PRD 103C

## What Changed

This document records the historical FAQ-only proof that taught the system stable repeated-field identity and fail-closed merge semantics. It is no longer an active implementation contract.

The former `buildFaqSavedTextGraph()` helper has been deleted. Generic identity-bearing extraction now lives in `packages/ck-contracts/src/translated-value-primitives.ts` and applies to every widget with authored text in `editable-fields.json`.

After PRD 103_01.3a, extraction was rebased to authored FAQ `editable-fields.json`.

The former FAQ-only `buildCurrentLanguageValues()` helper has been deleted. Tokyo now preserves, removes, and completes translated locale values through the generic saved text identity path.

The first verification run failed because the identity key still included array indexes. That was fixed by normalizing indexed paths back to the canonical contract path in `faqFieldIdentityKey()`. Reorder is now identity-stable.

## Field Identity

The historical FAQ proof keyed repeated fields by:

- `instanceId`
- `widgetType`
- canonical field path/role
- `sectionId`
- `faqId`

Concrete array index is display order only. Carried language values adopt the current concrete path after reorder without changing identity.

## Language Values

Historical language values carried:

- `locale`
- `value`
- `updatedAt`
- `jobId` where applicable

## Verification

- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm validate:widgets`

Fixtures cover:

- reorder without retranslation
- insert translating only new FAQ fields
- delete removing only deleted FAQ fields
- partial missing translation failing closed with previous values untouched
- duplicate/missing FAQ IDs failing before translation

TPM signoff: Superseded by 103J. A user must not see translations jump to the wrong repeated item when content is reordered, regardless of widget type.

Dev Manager signoff: Superseded by 103J. Merge semantics have one named generic authority, sourced from authored `editable-fields.json`.
