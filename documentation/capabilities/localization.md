# Localization Capability

Status: PRD 103K saved-base-content sync model. Final PRD 103 resume still requires implementation and smoke of `Execution_Pipeline_Docs/01-Planning/103K__EXEC__Saved_Base_Content_Translation_Sync_Runtime_Wiring.md`.

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

Use `@clickeen/l10n` only for locale data helpers:

- `normalizeLocaleToken`
- `localeCandidates`
- `normalizeCanonicalLocalesFile`
- `resolveLocaleLabel`

`@clickeen/l10n` must not own widget path extraction, translation job assembly, or storage identity.

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
2. Tokyo saves approved instance config/content.
3. User opens the Translations panel and clicks Generate translations.
4. Roma calls one Tokyo product command: generate translations for the account instance.
5. Tokyo resolves target locales, editable fields, current saved base content, existing translated values, missing/out-of-sync locales, and the saved base content marker.
6. Tokyo accepts async translation work for that marker and queues concrete locale jobs.
7. San Francisco translates concrete text primitive paths and values.
8. San Francisco completes the work through Tokyo with the marker it translated.
9. Tokyo applies translated locale values only if the marker still matches current saved base content.

No step repairs values, drops paths, guesses paths, scans widget software to rediscover meaning, or exposes storage object identity to Bob/Roma.

## Builder Preview

The Builder Translations panel is inspection and manual value override for translated locale values.

Roma shows account setup: base locale, plan translation allowance, target locales, sync state, and readiness counts. Bob's preview dropdown is populated from complete translated locales that Tokyo lists for the saved instance. Account-enabled languages without translated values for the current content are absent from the dropdown.

If current saved base content does not match the marker for existing translated values, Bob shows:

```txt
The base content has changed. Regenerate translations.
```

Generate is disabled while Tokyo reports active generation. Repeated Generate for the same active saved base content marker must not create competing jobs.

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

Publish/materialization consumes approved instance config/content plus translated locale values and writes generated visitor files under the instance folder:

```txt
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  {locale}.html
  styles.v{n}.css
  styles.css
  script.v{n}.js
  script.js
  script.v{n}.{locale}.js
  script.{locale}.js
```

Generated files are output. Publish status is product state. Publish, unpublish, and tier-serving operations materialize or remove those files. Visitor serving reads R2/CDN artifacts only; it does not query Supabase, compose translations, inspect account policy, or repair stale language output on visitor requests.

## Prague

Prague website copy is not account-widget authoring truth. Prague page translations are page-owned content beside page JSON. Missing non-base Prague page sidecars are build/request failures, not silent fallback to base copy.

Prague embeds account widgets only through public published artifacts:

```txt
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}/{locale}.html
```

`accountInstanceRef.locale` is a public artifact selector. It is not widget locale availability, private translation state, a generation marker, or an overlay/layer identity. Prague must not preserve or reintroduce account-widget localization storage vocabulary.

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
