# EXEC 103V - FAQ Single-Language Vertical Slice

Status: Superseded / Needs reproof after 103C.0
Date: 2026-05-18
PRD: `103V__PRD__FAQ_Single_Language_Vertical_Slice.md`

## Audit Result

The first execution was not accepted as final proof because the Bob review surface it proved was FAQ-specific. A later rerun proved a compiled review path. That is now also superseded by the PRD 103C.0 source-model correction: the vertical slice must be rerun against authored `content.json`.

## Scope Executed

- Added `selectFaqFieldsNeedingTranslation()` to `ck-contracts` so changed-field selection is a shared FAQ language contract, not private Roma logic.
- Updated Roma save follow-up to use the shared selector.
- Added a PRD 103 vertical verifier that proves:
  - one saved FAQ answer change is selected as one whole changed field;
  - the Instance Translation Agent accepts the job-shaped saved-instance request for that field;
  - `buildCurrentLanguageValues()` writes a complete current value set;
  - Bob review shows the translated answer from stored current language values;
  - preview can resolve from the same current language values;
  - missing changed translation fails closed without creating partial current language values.

## Architecture Result

- The thin path has executable proof for the superseded implementation only. It is not product-green until reproof uses authored `content.json`.
- The verification intentionally stays narrow: one FAQ instance, one changed field, one target language.
- No new product mode, preview truth, or compatibility fallback was introduced.

## Verification

- `pnpm verify:prd103-faq-vertical` - green
- `pnpm --filter @clickeen/ck-contracts test` - green
- `pnpm --filter @clickeen/ck-contracts typecheck` - green
- `pnpm --filter @clickeen/roma typecheck` - green
- `pnpm --filter @clickeen/bob typecheck` - green
- `pnpm --filter @clickeen/sanfrancisco typecheck` - green

## Residual Scope

- This is not the publish-language-files proof; that remains PRD 103G.
- This is not manual translation override editing; that remains PRD 103F.
