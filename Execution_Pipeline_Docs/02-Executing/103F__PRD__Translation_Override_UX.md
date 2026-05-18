# PRD 103F - Translation Override UX

Status: Complete / Manual overlay edit green
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103D.0, PRD 103D, PRD 103E, PRD 103G, PRD 103H, PRD 103I

## Purpose

Let a Bob user edit a translated value in the existing translation panel and save it back to the same Tokyo current-language overlay Bob already reviews and publish already consumes.

This slice is intentionally small. It does not add provenance, review states, audit systems, or a translator workspace.

## Slice 103F.1 Contract

- Bob edits current language values only for a selected translated locale that already has an overlay.
- Bob writes the full overlay `values` object back through Roma to Tokyo.
- Roma resolves the active instance/widget and language overlay code, then calls the existing Tokyo overlay write primitive.
- Tokyo creates the next overlay version and selects it, using the same validation as Translation Agent writes.
- Publish consumes the selected overlay value through the existing publish path.
- Translation remains separate and still uses `content.json`-derived saved text graph/current language values.
- No review-state status.
- No base-text hash provenance.
- No second translation authority.
- No audit/provenance layer.
- No new readiness/status subsystem.

## Slice 103F.1 Acceptance

- User can edit a translated value in Bob's Translations panel.
- Saving writes the edited value into the current language values overlay for that instance and locale.
- Bob refreshes overlay inventory/values after save and keeps showing the edited value.
- Publish uses the edited overlay value.
- Override save does not read or write Bob draft/base config.
- Override save cannot create partial overlay values.

## Slice 103F.1 Verification

- Bob test proves editable review rows emit the full updated values object for a translated field.
- Roma test proves locale overlay write resolves the active instance widget, locale code, and calls Tokyo overlay write.
- Tokyo-worker publish/overlay test proves selected overlay values are the publish source.
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`

## Slice 103F.1 Result

- Bob Translations panel renders editable current-language values for translated locales.
- Bob writes a full updated overlay `values` object through the hosted account command path.
- Roma exposes the editor-only locale overlay write route and resolves the active widget before writing.
- Tokyo continues to validate and version the overlay through the existing language overlay write primitive.
- Publish proof uses the manually edited translated value from the selected overlay.
- Removed the old base-text hash / review-state language-value contract shape from active contracts and Roma follow-up.
- No second translation authority, status layer, provenance layer, or translation-agent change was added.
