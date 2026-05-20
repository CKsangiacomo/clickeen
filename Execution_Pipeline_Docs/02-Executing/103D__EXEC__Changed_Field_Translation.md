# PRD 103D Execution - Changed Field Translation

Status: Complete / Rebased after 103C.0
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103B, PRD 103D.0

## What Changed

103D was simplified from "changed text" to "changed field" translation.

Clickeen does not do word-level diffing. If one word changes inside an FAQ answer, the whole answer field is translated. If a question changes, the whole question field is translated. If a title changes, the whole title field is translated.

The production FAQ save follow-up now:

1. receives the previous saved config from Tokyo as part of save
2. extracts previous and current FAQ field graphs from the canonical FAQ contract
3. reads existing current language values for the target locale
4. sends only whole new/changed/missing fields to the Instance Translation Agent
5. merges the result with existing values through `buildCurrentLanguageValues()`
6. writes a complete current language value map to Tokyo

The FAQ changed-field path no longer clears existing language overlays before translation. If the locale job fails, the last good current language values remain untouched.

Non-FAQ widgets still use the old full-graph compatibility path until they receive their own contract migration.

## Course Correction

This execution was rebased again by 103_01.3a and 103_01.3b. The FAQ field graph now comes from authored FAQ `editable-fields.json` through the widget-definition operation, not a generated widget catalog. Roma fails the FAQ locale job if Tokyo does not provide the previous saved config; it does not fall back to clear-and-full-retranslate.

## Files Changed

- `Execution_Pipeline_Docs/02-Executing/103D__PRD__Changed_Text_Translation.md`
- `tokyo-worker/src/domains/render/account-instance-transitions.ts`
- `tokyo-worker/src/routes/internal-render-routes.ts`
- `tokyo-worker/src/domains/widget-catalog.ts`
- `roma/app/api/account/instances/[instanceId]/route.ts`
- `roma/lib/account-instance-direct.ts`
- `roma/lib/account-babel-save-followup.ts`
- `packages/ck-contracts/src/faq-language-values.ts`
- `packages/ck-contracts/src/faq-language-values.test.ts`
- historical `scripts/build-widget-catalog.mjs` path, deleted in 103_01.3b
- historical `tokyo/product/widgets/manifest.json` path, deleted in 103_01.3b

## Verification

- historical `pnpm build:widgets`
- current replacement: `pnpm validate:widgets`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`

TPM signoff: Green for 103D. A user save translates whole changed FAQ fields and preserves the last good current language values on failure.

Dev Manager signoff: Green for 103D. Full-graph retranslating and clear-before-translate are gone from the FAQ changed-field product path.
