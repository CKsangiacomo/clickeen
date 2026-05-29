# EXEC 103F - Translation Override UX

Status: Historical green evidence / surviving doctrine extracted to PRD 105F; superseded by PRD 105, 105C, 105D, 105E, and 105F where conflicting
Date: 2026-05-20
PRD: `103F__PRD__Translation_Override_UX.md`

Archive note: this document is no longer active execution authority. It is retained as proof for the manual translated-locale overwrite model.

## Result

103F is green against the current product model. Manual translation edits are temporary translated-locale value overwrites: Bob edits one value, writes the full value map through Roma, Tokyo validates the map against the saved instance editable-fields contract, and Publish consumes the current translated-locale values.

No override status, provenance, source hash, review state, generation sidecar, or protection check was added. A later regeneration may overwrite the manual edit.

## Scope Executed

- Proved Bob builds a full updated translated-locale value object after one field edit.
- Proved Roma writes translated-locale values through one Tokyo product operation by locale.
- Added Tokyo proof that translated-locale product writes reject partial FAQ value maps.
- Reused the publish proof showing manually edited translated values are materialized into public files.

## Architecture Result

- Product payloads use locale/value-map operations, not overlay IDs or storage route vocabulary.
- Internal overlay storage remains an implementation primitive only.
- Manual edit is a direct overwrite of current translated-locale values and is intentionally not protected from later regeneration.

## Verification

- `pnpm --filter @clickeen/bob test` - green
- `pnpm --filter @clickeen/bob typecheck` - green
- `pnpm --filter @clickeen/roma test` - green
- `pnpm --filter @clickeen/roma typecheck` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green
- `pnpm --filter @clickeen/tokyo-worker typecheck` - green
- `pnpm verify:prd103-publish-language-files` - green

## Residual Scope

- This is not human Bob/Roma/public smoke. Human smoke remains the PRD 103 completion/release gate after automated runtime proofs.
