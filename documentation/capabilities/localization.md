# Localization Capability

Status: PRD 105 instance-folder/runtime model. Saved-base-content translation sync is current marker-based behavior, not job-lineage truth.

Localization translates account-instance content values into translated locale values. It is not a storage-object protocol, a runtime fallback system, or a second widget source model.

## Core Principle

- Locale is a runtime parameter for authoring preview and public serving.
- Locale is not base instance identity.
- Product identity for account-widget translation is `instanceId + locale`.
- Storage object names, overlay IDs, generated filenames, and private R2 keys are not product identity.
- The translated value body is an exact path/value map.
- Translation sync is determined by whether translated values were generated from the current saved base content marker.

There is no account-widget `localization.json`, layer sidecar, text pack, selected-locale pointer, or compatibility bridge to old pre-GA l10n storage. The saved base content marker is private Tokyo operation state for sync; it is not a public storage identity or widget source model.

## Canonical Locale Registry

`packages/l10n/locales.json` is the canonical registry of supported locale tokens and labels.

Use `@clickeen/l10n` for locale data helpers:

- `normalizeLocaleToken`
- `localeCandidates`
- `normalizeCanonicalLocalesFile`
- `resolveLocaleLabel`

`@clickeen/l10n` also owns generic translation safety primitives that are not
specific to one agent or product flow:

- `assertTranslationSafety`
- `TranslationSafetyError`
- placeholder parity checks
- richtext tag and anchor integrity checks

`@clickeen/l10n` must not own widget path extraction, translation job assembly,
agent prompts, agent output contracts, or storage identity.

## Account Locale Policy

Account-mode effective localization is:

```txt
entitlements + account active locales + saved instance content
```

Entitlement keys include:

- `l10n.locales.max`
- `l10n.versions.max`

Account active locales are managed in Roma Settings. Builder edits one active base-locale instance at a time. Translation generation is explicit work from the Translations panel, not a hidden save side effect.

## Widget Text Source

Each widget declares customer-visible editable/translatable fields in:

```txt
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Collection declarations are extraction instructions only. They are expanded against `instance.content.json` into concrete paths such as:

```txt
sections.0.faqs.0.question
sections.0.faqs.0.answer
```

Producers receive concrete paths and base values. No producer receives wildcard, glob, template, storage path, or sidecar paths.

## Translation Generate Flow

1. User saves one widget instance in Bob/Roma.
2. Roma submits approved instance config/content artifacts; Tokyo stores them.
3. User opens the Translations panel and clicks Generate translations.
4. Roma reads the current account active locales from account settings.
5. Roma returns `coreui.errors.translation.generationUnavailable` until San
   Francisco owns a real async generation endpoint, queue production, and
   operation state.
6. Tokyo-worker remains the storage boundary for exact translated-locale overlay
   files that Roma writes through the translated-values route.

No step repairs values, drops paths, guesses paths, scans widget software to rediscover meaning, or exposes storage object identity to Bob/Roma.

## Builder Preview

The Builder Translations panel is inspection and manual value override for translated locale values.

Roma shows account setup: base locale, plan translation allowance, account active locales, sync state, and readiness counts. Bob's preview dropdown is populated from complete translated locales that Tokyo lists for the saved instance. Account active languages without translated values for the current content are absent from the dropdown.

If current saved base content does not match the marker for existing translated values, Bob shows:

```txt
The base content has changed. Regenerate translations.
```

Generate cannot start while no San Francisco generation owner exists. When a
future generation owner is introduced, repeated Generate for the same active
saved base content marker must not create competing jobs.

When a translated locale is selected, Bob preview resolves:

```txt
base instance state + one translated locale value map
```

Manual edits overwrite the current translated value map for that locale. The system does not store override status, review status, provenance, or a protected manual layer. If that field is regenerated, the new AI translation replaces the manual value.

## Public Static Locale Serving

Public serving is generated static artifact delivery. It is not runtime translation composition.

The public serving coordinate is:

```txt
accountPublicId + instanceId
```

The public static route is:

```txt
https://clk.live/{accountPublicId}/{instanceId}
```

Builder save writes the current public widget package under the instance folder:

```txt
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  styles.css
  runtime.js
```

Durable translated locale values live privately under `overlays/locales/{locale}.json`; they are translated value source, not visitor files. Public package files are output submitted on save. Publish status is product state. Publish, unpublish, and tier-serving operations gate serving of those files; they do not rebuild widget package bytes. Visitor serving reads R2/CDN artifacts only; it does not query Supabase, compose translations, inspect account policy, or repair stale language output on visitor requests.

## Prague

Prague website copy is not account-widget authoring truth. Prague page translations are page-owned content beside page JSON. Missing non-base Prague page sidecars are build/request failures, not silent fallback to base copy.

Prague embeds account widgets only through public published artifacts:

```txt
https://clk.live/{accountPublicId}/{instanceId}
```

`accountInstanceRef.locale`, if reintroduced by a future public runtime contract, is only a public locale selector. It is not widget locale availability, private translation state, a generation marker, or an overlay/layer identity. Prague must not preserve or reintroduce account-widget localization storage vocabulary.

## Deleted Pre-GA Concepts

The following are not part of the active account-widget localization capability:

- Widget `localization.json`.
- `textPack`.
- `L10nOp`.
- Public base snapshots/fingerprints as storage identity.
- Overlay status/readiness inside translated value bodies.
- User-authored translation layers.
- Locale-suffixed instance IDs.
- Selected-locale or selected-overlay pointers as product truth.
- Public serving from old `/l10n/widgets/**` truth as an identity authority.
- Instance-only public widget routes.
- Instance-only public render routes.
- Root `published/`, root `public/`, or root `l10n/` lookup folders as public localization authority.
