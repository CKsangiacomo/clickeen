# PRD 103D.0 Execution - FAQ Identity, Diff, And Merge Contract

Status: Complete / Production proof green
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103C.1, PRD 103C

## What Changed

Added the FAQ language value identity and merge contract in `@clickeen/ck-contracts`.

The new `buildFaqSavedTextGraph()` extracts FAQ text using stable section/FAQ IDs from the canonical FAQ content contract.

After PRD 103C.0, extraction was rebased to authored FAQ `content.json`.

The new `buildCurrentLanguageValues()` is the single merge authority for current language values. It carries unchanged translations forward, translates changed/new fields, removes deleted fields, and fails closed on partial missing translation.

The first verification run failed because the identity key still included array indexes. That was fixed by normalizing indexed paths back to the canonical contract path in `faqFieldIdentityKey()`. Reorder is now identity-stable.

## Field Identity

FAQ repeated fields are keyed by:

- `instanceId`
- `widgetType`
- canonical field path/role
- `sectionId`
- `faqId`

Concrete array index is display order only. Carried language values adopt the current concrete path after reorder without changing identity.

## Language Values

Language values carry:

- `locale`
- `value`
- `updatedAt`
- `jobId` where applicable

## Verification

- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm build:widgets:check`

Fixtures cover:

- reorder without retranslation
- insert translating only new FAQ fields
- delete removing only deleted FAQ fields
- partial missing translation failing closed with previous values untouched
- duplicate/missing FAQ IDs failing before translation

TPM signoff: Green. A user must not see translations jump to the wrong FAQ when content is reordered.

Dev Manager signoff: Green. Merge semantics have one named authority, sourced from authored `content.json`.
