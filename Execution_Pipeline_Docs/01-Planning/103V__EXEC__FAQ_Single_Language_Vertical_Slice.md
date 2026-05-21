# EXEC 103V - FAQ Single-Language Vertical Slice

Status: Complete / Green after panel-owned Generate reproof
Date: 2026-05-20
PRD: `103V__PRD__FAQ_Single_Language_Vertical_Slice.md`

## Result

The reopened 103V slice is green. It now proves the current product path:

```text
Bob saves base FAQ content only
user clicks Generate in the Translations panel
Tokyo queues translation work from saved instance content
San Francisco executes the Instance Translation Agent job
Tokyo writes current translated locale values
Bob renders the translated FAQ value through the production Translations panel review path
```

## Scope Executed

- Added `selectFaqFieldsNeedingTranslation()` to `ck-contracts` so changed-field selection is a shared FAQ language contract, not private Roma logic.
- Removed Save-owned translation generation from the accepted product path; panel-owned Generate is the trigger.
- Added a PRD 103 vertical verifier that proves:
  - one saved FAQ answer change is selected as one whole changed field;
  - the Instance Translation Agent accepts the job-shaped saved-instance request for that field;
  - `buildCurrentLanguageValues()` writes a complete current value set;
  - Bob review shows the translated answer from stored current language values;
  - preview can resolve from the same current language values;
  - missing changed translation fails closed without creating partial current language values.
- Re-tightened the Tokyo product-operation test so an existing translated locale with one edited FAQ answer queues `sections.0.faqs.0.answer`, not a different text path.

## Architecture Result

- The thin path uses the current source model: FAQ `editable-fields.json`, saved `instance.content.json`, translated locale values, and the Instance Translation Agent job contract.
- The verification intentionally stays narrow: one FAQ instance, one changed FAQ answer, one target language, one visible translated value in Bob.
- No new product mode, preview truth, or compatibility fallback was introduced.
- This does not claim the publish-language-files path green; that remains PRD 103G.

## Verification

- `pnpm verify:prd103-faq-vertical` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green
- `pnpm --filter @clickeen/ck-contracts test` - green
- `pnpm --filter @clickeen/ck-contracts typecheck` - green
- `pnpm --filter @clickeen/roma test` - green
- `pnpm --filter @clickeen/roma typecheck` - green
- `pnpm --filter @clickeen/bob test` - green
- `pnpm --filter @clickeen/bob typecheck` - green
- `pnpm --filter @clickeen/sanfrancisco test` - green
- `pnpm --filter @clickeen/sanfrancisco typecheck` - green
- `pnpm validate:widgets` - green
- `node scripts/verify/primitive-drift.mjs` - green

## Residual Scope

- This is not the publish-language-files proof; that remains PRD 103G.
- This is not manual translation override editing; that remains PRD 103F.
- Human Bob/Roma/public smoke remains deferred until the runtime path is complete enough to test after 103G.
