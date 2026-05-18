# EXEC 103E - Translation Panel FAQ Text Review

Status: Superseded / Needs rewrite after 103C.0
Date: 2026-05-18
PRD: `103E__PRD__Translation_Panel_FAQ_Text_Review.md`

## Audit Result

The first execution was not accepted as green.

It added FAQ-specific review helpers in Bob. That proved the first FAQ display shape but violated PRD 103's surviving authority at the time. FAQ-specific review logic is not a future-widget pattern and must be removed.

The rework removed the active FAQ-specific review path and rendered translated values from a compiled review path. That is now superseded: Bob review must derive from authored `content.json` or its generated translation projection.

## Scope Executed

- Added contract-driven translation review helpers in Bob that build grouped read-only rows from stored current language values. This is implementation-green for the superseded model only.
- Removed Bob-owned translation status vocabulary; Bob compares Roma settings with Tokyo overlays.
- Wired Bob's Translations panel to receive locale overlay values and render FAQ current language values for the selected language.
- Preserved preview behavior as a separate locale preview path.
- Added Bob test coverage for stored-value review rendering and missing values inside an existing overlay.

## Architecture Result

- Bob no longer treats preview as proof that translations exist.
- Bob does not invent per-language translation status.
- Bob shows `X of Y translations ready` when Tokyo has fewer overlays than Roma settings require.
- While translations are incomplete, clicking the dropdown refreshes Tokyo overlay inventory.
- The review UI speaks the same language as the save pipeline: current language values.
- The slice stays read-only; translation override editing remains PRD 103F.
- The review builder must be rebased to authored `content.json`.

## Verification

- `pnpm --filter @clickeen/bob test` - green after rework
- `pnpm --filter @clickeen/bob typecheck` - green after rework

## Residual Scope

- Full browser E2E should be covered by PRD 103V once the single-language vertical slice is executed.
- Manual translated-value override editing is intentionally deferred to PRD 103F.
- Full browser E2E remains outside this slice.
