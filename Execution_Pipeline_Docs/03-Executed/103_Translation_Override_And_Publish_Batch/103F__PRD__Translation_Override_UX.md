# PRD 103F - Translation Override UX

Status: Historical green evidence / surviving doctrine extracted to PRD 105F; superseded by PRD 105, 105C, 105D, 105E, and 105F where conflicting
Owner: Product + Architecture
Date: 2026-05-20
Parent: `103__PRD__Saved_Instance_Localization_Runtime.md`
Depends on: PRD 103J, PRD 103K, PRD 103G, PRD 103H, PRD 103I

Archive note: this document is no longer active execution authority. Current manual translated-locale edit and materialization authority is `../105_Instance_Runtime_And_Verification_Batch/105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md`.

## Purpose

Let a Bob user edit a translated value in the existing Translations panel and save it back to the same Tokyo translated-locale values Bob already reviews and Publish already consumes.

## Current Authority Note

The manual write primitive remains useful only if Bob's review rows come from PRD 103J generic editable-fields contracts and PRD 103K saved-base-content sync state. Any wording below about translated-locale inventory refresh means "refresh current Tokyo translated values for the selected locale"; it is not generation progress authority.

This slice is intentionally small. It does not add provenance, review states, audit systems, or a translator workspace.

## Slice 103F.1 Contract

- Bob edits current translated-locale values only for a selected translated locale that already exists.
- Bob writes the full translated-locale `values` object back through Roma to Tokyo.
- Roma resolves the active account instance and locale, then calls Tokyo's translated-locale value product operation.
- Tokyo validates the full value map against the saved instance editable-fields contract before accepting it.
- Publish consumes the current translated-locale values through the existing publish path.
- Translation remains separate and uses `editable-fields.json` plus the current saved base content to generate translated locale values.
- A manual edit is temporary by design: it only overwrites the current translated-locale values object.
- The system does not remember that the value was manually edited, does not store override status, and does not run protection checks for that value.
- If that field is regenerated later, the new AI translation overwrites the manual edit.
- No review-state status.
- No base-text hash provenance.
- No second translation authority.
- No audit/provenance layer.
- No new readiness/status subsystem.

## Slice 103F.1 Acceptance

- User can edit a translated value in Bob's Translations panel.
- Saving writes the edited value into the current translated-locale values for that instance and locale.
- Bob refreshes translated-locale readiness/values after save and keeps showing the edited value.
- Publish uses the edited translated-locale value.
- Override save does not read or write Bob draft/base config.
- Override save cannot create partial translated-locale value maps.

## Slice 103F.1 Verification

- Bob test proves editable review rows emit the full updated values object for a translated field.
- Roma test proves translated-locale value write calls one Tokyo product operation with a locale and full value map.
- Tokyo-worker test proves translated-locale writes expose no overlay identity and reject partial value maps.
- Publish verifier proves edited translated-locale values are the publish source.
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`

## Slice 103F.1 Result

- Bob Translations panel renders editable current-language values for translated locales.
- Bob writes a full updated translated-locale `values` object through the hosted account command path.
- Roma exposes the editor-only translated-locale value write route and forwards one product operation to Tokyo.
- Tokyo validates full translated-locale values through the saved instance editable-fields contract and rejects partial maps.
- Publish proof uses the manually edited translated value from current translated-locale values.
- Removed the old base-text hash / review-state language-value contract shape from active contracts and Roma follow-up.
- No second translation authority, status layer, provenance layer, or translation-agent change was added.

## Green Evidence

- `pnpm --filter @clickeen/bob test` - green
- `pnpm --filter @clickeen/bob typecheck` - green
- `pnpm --filter @clickeen/roma test` - green
- `pnpm --filter @clickeen/roma typecheck` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green
- `pnpm --filter @clickeen/tokyo-worker typecheck` - green
- `pnpm verify:prd103-publish-language-files` - green
