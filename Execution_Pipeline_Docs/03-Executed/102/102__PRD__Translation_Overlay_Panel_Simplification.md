# PRD 102 - Translation Overlay Panel Simplification

Status: Complete
Owner: Product + Architecture
Date: 2026-05-17
Depends on: PRD 100 - Static Public Embed Delivery

PRD 103_02 SUPERSESSION NOTE: this executed PRD is historical for the panel simplification intent, but its overlay-inventory/`overlayId` preview contract is not current target architecture. PRD 103_02 owns the replacement with translated-locale list/read/write operations where Roma/Bob do not expose overlay object identity.

## Purpose

Simplify the Builder Translations panel so it reflects the real product model instead of creating a runtime translation status machine.

Builder editing happens in one account, one widget instance, and one active base locale. Translation is async follow-up work after Save. Locale preview is read-only inspection of overlay files that already exist for that instance in Tokyo/R2.

The panel must stop asking the system whether translations should exist. It must show account setup from Roma and preview only actual stored overlays from Tokyo/R2.

## Product Truth

The Translations panel has two responsibilities:

1. Roma-owned setup summary.
2. Bob-owned preview dropdown backed by actual Tokyo/R2 overlay files.

These are different truths and must not be merged into one synthetic "translation status" payload.

Roma knows account policy and settings:

- base locale for the account
- translations available in the user's plan
- active translations selected in account settings

Tokyo/R2 knows what overlay files physically exist for the instance:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
```

Bob previews only those existing overlay files. If a locale overlay file does not exist, that locale is not previewable. Bob does not ask why it is missing.

## Non-Negotiables

- Translation generation is async follow-up work after Save.
- Bob does not generate translations.
- Roma does not generate translations.
- The Translations panel does not call San Francisco.
- The preview dropdown does not call Berlin or account policy.
- Roma may authenticate and transport storage reads, but it must not synthesize overlay availability.
- Tokyo-worker lists/reads exact overlay files. It must not infer product meaning, call Roma, call Berlin, or call San Francisco.
- Missing overlay file means absent dropdown option, not a disabled target-language row.
- No runtime "checking language values" state belongs in the panel.
- No progress payload from desired locales belongs in the panel.
- No `selected-overlays` concept belongs in the Builder preview contract.
- Overlay preview is always `current in-memory base config + one exact overlay value map`.

## Target UX

The Translations panel shows:

```text
Translations

Base locale: English
Translations available in your plan: 29
Active translations: 3

Preview locale
[dropdown]
```

The setup summary is Roma-owned display data. It tells the user what their account is configured for. It does not promise that overlay files are ready.

The dropdown is Bob preview state. It contains:

- the base locale
- locale options for actual valid locale overlay files under the instance `overlays/` folder

Empty overlay state is simple:

```text
Base locale only
```

or:

```text
No saved translation overlays yet.
```

The panel must not say:

- "Checking language values"
- "Language values unavailable"
- "Save changes first" as a translation-status explanation
- "0 of N target languages can be previewed" when `N` comes from policy

## Target Architecture

### Roma Setup Summary

Roma owns account setup display because Roma is the authenticated account shell.

Roma derives the setup summary from the real account/session/settings context and provides it to Bob as a Builder-open snapshot:

```json
{
  "v": 1,
  "baseLocale": "en",
  "planTranslationsMax": 29,
  "activeLocales": ["es", "ja", "it"]
}
```

This payload is display setup only. It must not include overlay IDs, overlay values, translation job progress, or inferred readiness.

If account settings change while Builder is open, Roma may refresh the snapshot through the normal Builder host channel. That is a Roma account-shell concern, not an overlay availability concern.

### Bob Overlay Preview

Bob owns preview state inside Builder.

Bob requests actual previewable locale overlays for the currently open instance. Because the browser cannot hold private storage credentials, the request may travel through Roma as an authenticated pass-through, but Roma must remain transport only for this path.

The preview contract returns actual storage facts:

```json
{
  "v": 1,
  "baseLocale": "en",
  "overlays": [
    {
      "locale": "es",
      "overlayId": "00000001FAQAB12CD34EFES00A0100000ZZ"
    }
  ]
}
```

When the user selects a locale, Bob reads the exact overlay value object and applies it with the shared single-overlay resolver.

The preferred implementation is lazy value loading on selection. The list request should not need to hydrate every overlay body unless the implementation proves that is simpler and still fast.

### Tokyo/R2 Overlay Inventory

Tokyo-worker must expose one account-authenticated internal read for locale overlay inventory for an instance.

The inventory source is the instance `overlays/` folder. It may be implemented by listing R2 objects or by a Tokyo-maintained storage index that is updated by overlay writes/deletes, but the product truth is still physical overlay presence.

The inventory response must:

- validate account ownership from the path and `overlayId`
- return only overlay IDs that parse and belong to the requested account + instance
- group by locale coordinate from `overlayId`
- return the latest valid overlay per locale when multiple version slots exist
- ignore malformed files instead of showing them to Bob
- never read Berlin, Roma policy, or San Francisco

The overlay body remains exactly:

```json
{
  "v": 1,
  "values": {}
}
```

Locale, account, instance, widget, and version coordinates come from `overlayId` and storage containment, not from body metadata.

### Async Translation Boundary

Save may trigger translation work according to account settings and policy. That orchestration lives after the Save boundary.

The translation agent writes locale overlay objects to Tokyo/R2. Once the file exists, Bob can preview it. If the file does not exist yet, Bob cannot preview that locale yet.

No part of Builder panel rendering should ask the translation agent whether work is queued, running, failed, or expected.

## Current Drift To Remove

Current implementation mixes setup, policy, storage, progress, and preview into one runtime path:

- Bob calls a `load-translations` hosted command.
- Roma serves `/api/account/instances/{instanceId}/translations`.
- Roma loads account language policy from Berlin.
- Roma loops desired locales from policy.
- Roma calls Tokyo selected-overlay reads for each locale.
- Roma reads overlay objects and builds `languages`, `valuesByLanguage`, and `progress`.
- Bob turns that synthetic payload into "checking", "unavailable", and "previewable" UI states.

That is the wrong shape.

This PRD deletes that mixed payload from the Builder preview path. Desired languages, plan limits, and active settings belong in the Roma setup summary. Actual previewable locales come only from actual overlay files.

## Execution Slices

### 102A - Contract And Deletion Guard

Define the two surviving payloads:

- `translationSetup` from Roma account context
- `localeOverlayInventory` from Tokyo/R2 storage facts

Add tests or static guards that prevent the Builder preview path from importing or calling:

- `loadAccountBabelLanguagePolicy`
- Berlin policy loaders
- San Francisco translation endpoints
- translation agent status APIs

Done when the mixed "translations panel payload" is no longer the contract.

### 102B - Tokyo Overlay Inventory Read

Add the Tokyo-worker internal read for actual instance locale overlays.

Acceptance:

- Given overlay files under one instance, the route returns locale + overlayId rows.
- Given no overlay files, the route returns an empty list.
- Given malformed overlay filenames, the route ignores them.
- Given another account or instance, the route rejects or returns nothing.
- The route performs no policy/status/orchestration work.

### 102C - Roma Auth Pass-Through And Setup Snapshot

Roma provides `translationSetup` to Bob from real account context.

Roma replaces the current translations aggregation path with a thin authenticated storage read to Tokyo for overlay inventory/read. Roma may validate the account and instance. Roma must not decide which locales should be previewable.

Acceptance:

- Roma setup summary includes base locale, plan translation allowance, and active translation count/locales.
- Roma overlay preview route calls Tokyo only.
- Tests prove the preview route does not call Berlin policy.
- The old `/api/account/instances/{instanceId}/translations` behavior is removed or replaced by the new storage-fact contract.

### 102D - Bob Panel Rewrite

Bob renders the split panel.

Acceptance:

- Top section shows Roma setup summary only.
- Dropdown includes base locale plus actual overlay locales.
- Missing overlays are absent.
- Selecting a locale loads exactly one overlay object and applies it over the current in-memory base config.
- Switching back to base locale removes the overlay preview.
- Dirty editor state does not become a translation status machine. If overlay preview while dirty is unsafe in implementation, Bob may temporarily force base preview while dirty with neutral UI copy, but it must not present policy/status/progress language.

### 102E - Documentation And Cleanup

Update architecture docs to reflect:

- panel setup truth is Roma account context
- preview availability truth is Tokyo/R2 overlay presence
- translation generation is async after Save
- Bob preview does not ask Berlin/San Francisco

Remove stale tests and UI copy that preserve desired-locale availability, `progress`, or selected-overlay pointer language in the Builder preview path.

## Verification

Required checks:

- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm -C tokyo-worker test`
- `pnpm -C tokyo-worker typecheck`
- targeted Roma route tests for the pass-through path
- targeted Bob panel tests for base-only and overlay-present states

Manual smoke:

1. Open an FAQ instance with no locale overlays. Panel shows setup summary and base locale only.
2. Write one valid locale overlay to Tokyo/R2. Reopen Builder or refresh the dropdown. That locale appears.
3. Select the locale. Preview applies the exact overlay values.
4. Delete the overlay file. Refresh the dropdown. The locale disappears.
5. Confirm no request path from dropdown load or selection calls Berlin or San Francisco.

## Out Of Scope

- Building the translation agent.
- Fixing translation quality.
- Adding translation job progress UI.
- Adding a manual "generate translations now" action.
- SEO/GEO locale output behavior.
- Public `clk.live` locale pages.
- Reworking the overlay ID format.
- Reworking account locale settings.

## Done

PRD 102 is done when Builder translation preview is a simple storage-backed overlay preview:

```text
Roma shows account setup.
Tokyo/R2 stores actual overlays.
Bob previews actual overlays.
San Francisco translates after Save.
```

No other system asks another system whether a preview locale should exist.
