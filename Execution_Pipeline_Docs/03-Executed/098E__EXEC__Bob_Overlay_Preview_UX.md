# PRD 098E - Bob Overlay Preview UX

Status: Executed  
Parent: `Execution_Pipeline_Docs/01-Planning/098__PRD__Overlay_Primitive_And_Locales_First_Application.md`  
Owner: DEV + TPM  
Sequence: 5 of 6  
Depends On: 098A, 098B, 098C, 098D green

## Core Tenet: PRD 098 Truth Is The Only Truth

Bob Builder preview must consume the PRD 098 model only. Existing pre-GA sessions, URLs, preview payloads, and translation panel code must be refactored to compact instance IDs, selected overlay IDs, and `spec.json` primitive values.

The old Builder preview truth:

```text
ins_* instanceId + readyLocales + textPacks + public /l10n/widgets fetches
```

does not survive.

The surviving preview truth is:

```text
compactInstanceId + selected overlay values from Roma/Tokyo + resolveOverlay(baseConfig, overlayValues)
```

No dual preview path, stale text-pack cache, old public l10n fetch, publish-first save gate, or old ID support is allowed. Existing active Builder objects must be opened through the new identity or recreated.

## Purpose

Make Builder preview use the new overlay primitive.

Bob previews one widget in one active language at a time. It receives selected overlay values from Roma/Tokyo and applies them with the shared resolver. It does not consume old text packs or readiness status.

## Product Outcome

The Translations panel becomes trustworthy:

- if Czech is selectable, the preview is actually Czech
- title, CTA, section labels, questions, and answers change together
- after editing and saving English text, stale old Czech is not shown as current

## Non-Negotiables

- Bob does not read public Venice l10n URLs for Builder preview.
- Bob does not consume `textPack`.
- Bob does not use `readyLocales`.
- Bob does not infer availability from status flags.
- Bob does not show stale translated values after a base save.
- Bob previews one selected language overlay at a time.
- If selected overlay does not exist, that language is not previewable.

## UX Model

### Manual editing

Manual editing remains the default.

Save button remains always visible for published and unpublished instances. Publishing state must not block editing or saving.

### Translations panel

The panel shows:

- base language
- account-enabled target languages
- which target languages currently have a selected overlay pointer
- operational message if generation is in progress or failed

Only languages with selected overlay values are previewable.

Operational progress is UI information only. It never decides overlay truth.

### Preview behavior

When the user selects a previewable language:

1. Bob asks Roma for selected overlay values for that language.
2. Bob applies `resolveOverlay(baseConfig, overlayValues)`.
3. Bob sends the resolved preview state through the existing preview message path.

If no selected overlay exists:

- preview stays in base language
- panel explains that language values are not available for the current save
- no stale older overlay is applied

## New LOC Blast Radius

Expected new code is limited to:

- Bob selected-overlay preview state
- Roma translations route response using selected overlay pointers and overlay values
- small UI copy/states for unavailable current-language overlay values
- tests for previewable vs unavailable languages

New code must not include:

- a second preview truth
- public Venice l10n fetches
- a local Bob readiness engine
- stale overlay cache selection
- save/publish gating logic

## Deletion LOC Blast Radius

Expected deletions/replacements include:

- `translationTextPacks`
- `effectiveTranslationTextPack`
- old queued/working polling as preview truth
- `readyLocales` as previewability truth
- public `/l10n/widgets/.../overlay.json` preview fetches
- any "Publish first" inactive save button behavior in Builder

Keep existing manual ToolDrawer editing behavior and existing preview iframe messaging where it can carry the resolved state cleanly.

## Service Blast Radius

### `bob`

Affected files:

- `bob/components/BuilderApp.tsx`
- `bob/components/Workspace.tsx`
- `bob/components/TranslationsPanel.tsx`
- `bob/components/ToolDrawer.tsx`
- `bob/components/useTranslationsPreviewState.ts`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/useSessionSaving.ts`
- `tokyo/product/widgets/shared/previewL10n.js`
- widget preview iframe message handlers if they consume `translationTextPack`

Delete:

- `translationTextPacks`
- `effectiveTranslationTextPack`
- old polling based on `status === queued/working`
- `readyLocales` as previewability truth
- public `/l10n/widgets/.../overlay.json` preview fetch

Add:

- selected overlay values response type
- resolver use through shared contract in Bob host code
- explicit base preview remains active when selected overlay does not exist

### `roma`

Affected files:

- `roma/app/api/account/instances/[instanceId]/translations/route.ts`
- `roma/lib/account-instance-translations.ts`
- `roma/components/builder-domain.tsx`

Route response must change from text-pack/status model to selected overlay model.

Target response shape:

```json
{
  "v": 1,
  "baseLanguage": "ENUS",
  "languages": [
    {
      "language": "ITIT",
      "label": "Italiano",
      "overlayId": "..."
    }
  ],
  "valuesByLanguage": {
    "ITIT": {
      "title": "..."
    }
  },
  "progress": []
}
```

`progress` is optional operational UI data. It is not overlay truth and must not be consumed by Venice.

Route rule:

- A language appears as previewable only when Roma can return a selected `overlayId` and its values.
- Account-enabled but not-yet-produced languages can appear as unavailable UI rows.
- Unavailable rows must not include stale values.

### `tokyo-worker`

Used through selected-overlay read and overlay object read.

### `sanfrancisco`

No Bob dependency. San Francisco results arrive through Roma/Tokyo flow.

### `venice`

No runtime dependency in this slice.

## Implementation Steps

1. Change Roma translations route to read selected-overlay pointers and overlay objects.
2. Return language options based on account locale policy plus selected overlays.
3. Remove old text pack/status response parsing from Roma.
4. Change Bob translations hook to consume selected overlay values.
5. Remove ready-locale polling from BuilderApp.
6. Change Workspace preview message so Bob applies selected overlay values through the shared resolver before sending preview state.
7. Remove public l10n fetch path from widget preview helper.
8. Update TranslationsPanel copy so it does not claim "ready" based on status.
9. Add Bob tests for selectable vs unavailable languages.
10. Add browser smoke for FAQ full text translation preview.

## UX Acceptance Criteria

- Save button is visible for published and unpublished widgets.
- No "Publish first" inactive button remains in Builder save flow.
- Selecting Italian changes FAQ title, CTA, questions, answers, and section text when values exist.
- Selecting Czech with no selected overlay does not show stale Czech.
- After editing English question text and saving, old target-language text is not previewed as current.
- Delete/reorder/add QA controls continue to operate in manual editing mode.

## Documentation Updates Required

This slice is not done until these docs are updated or explicitly marked unchanged in the PR description with a reason:

- `documentation/services/bob.md`
  - Update Builder localization preview model: Bob consumes selected overlay values through Roma, applies shared resolver, and sends resolved preview state.
  - Remove references to `translationTextPacks`, `readyLocales`, public l10n URLs, or localization as a second save lane.
  - Document that Save is always available for published and unpublished instances.
- `documentation/services/roma.md`
  - Document `/api/account/instances/:instanceId/translations` selected-overlay response shape and progress-as-UI-only rule.
- `documentation/architecture/CONTEXT.md`
  - Update Builder translation preview section: account-authenticated read-only inspection uses selected overlay values, not text packs.
- `documentation/capabilities/localization.md`
  - Document UX behavior for previewable/unavailable languages and stale overlay prevention.
- `documentation/widgets/FAQ/FAQ_PRD.md`
  - Add acceptance that FAQ preview changes title, CTA, questions, answers, and section text together when a language overlay exists.

## Verification Gates

This slice is not green until all pass:

```bash
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm typecheck
```

Required scans:

```bash
rg -n "translationTextPacks|effectiveTranslationTextPack|textPack|readyLocales|status === 'queued'|status === 'working'|/l10n/widgets" bob roma tokyo/product/widgets/shared
```

Manual/product smoke:

- open published FAQ
- save an edit
- open translations panel
- select a language with selected overlay
- verify title and every Q/A text change
- switch back to manual editing
- save again
- verify no stale overlay appears

## Stop Conditions

Stop immediately if:

- Bob needs public runtime l10n routes to preview Builder
- Bob decides previewability from status flags
- stale overlays remain selectable after base save
- save UI depends on published/unpublished state

## Definition Of Done

- Bob consumes selected overlay values, not old text packs.
- Translation preview is exact and complete for FAQ.
- Progress UI cannot become overlay truth.
- Published state does not block Builder save.

## Execution Result

Executed as the PRD 098 selected-overlay model, with no old text-pack or ready-locale preview path preserved.

Completed:

- Roma translations route now returns selected overlay IDs and value maps: `{ v, baseLanguage, languages, valuesByLanguage, progress }`.
- Bob normalizes selected overlay payloads and only makes languages previewable when an `overlayId` and matching values exist.
- Bob applies `resolveOverlay(baseConfig, overlayValues)` before sending preview state to the iframe.
- Dirty base edits clear target-language preview so stale overlays are not displayed as current.
- Tokyo selected-language pointers are cleared before a new Babel generation attempt so failed regeneration does not leave old selected values active.
- Public `/l10n/widgets/...` Builder preview fetching was removed from the widget preview helper.
- Save remains visible for published and unpublished widgets; no `Publish first` save gate remains in the scanned product path.
- Bob, Roma, architecture, localization, and FAQ documentation were updated to the selected-overlay preview model.

Verification completed:

```bash
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm typecheck
rg -n "translationTextPacks|effectiveTranslationTextPack|textPack|readyLocales|status === 'queued'|status === 'working'|/l10n/widgets" bob roma tokyo/product/widgets/shared
rg -n "Publish first|publish first|translationTextPacks|effectiveTranslationTextPack|textPack|readyLocales|status === 'queued'|status === 'working'|/l10n/widgets" bob roma tokyo/product/widgets/shared
```

The `rg` gates returned no matches.

Cloud product smoke is environment-dependent and must be run after deploy with a real account session. The automated gates above are green; 098F remains responsible for the full publish-to-Venice runtime smoke.
