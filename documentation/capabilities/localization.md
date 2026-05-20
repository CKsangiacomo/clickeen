# Localization Capability

Status: PRD 103_00 product-operation model. Final PRD 103 resume still requires the manual smoke and Product + Architecture signoff recorded in `Execution_Pipeline_Docs/02-Executing/103_00__EXEC__Pre_103_Architecture_Gate.md`.

Localization translates account-instance content values into translated locale values. It is not a storage-object protocol, a runtime fallback system, or a second widget source model.

## Core Principle

- Locale is a runtime parameter for authoring preview and public serving.
- Locale is not base instance identity.
- Product identity for account-widget translation is `instanceId + locale`.
- Storage object names, overlay IDs, generated filenames, and private R2 keys are not product identity.
- The translated value body is an exact path/value map.

There is no account-widget `localization.json`, layer sidecar, text pack, base-fingerprint identity, selected-locale pointer, or compatibility bridge to old pre-GA l10n storage.

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
2. Tokyo saves approved instance config/content and marks changed content fields for translation pickup.
3. User opens the Translations panel and clicks Generate translations.
4. Roma calls one Tokyo product command: generate translations for the account instance.
5. Tokyo resolves target locales, editable fields, current `instance.content.json`, existing translated values, missing locales, and changed fields.
6. Tokyo accepts async translation work and queues concrete locale jobs.
7. San Francisco translates concrete text primitive paths and values.
8. San Francisco completes the job through Tokyo.
9. Tokyo validates exact paths and writes translated locale values by locale.

No step repairs values, drops paths, guesses paths, scans widget software to rediscover meaning, or exposes storage object identity to Bob/Roma.

## Builder Preview

The Builder Translations panel is inspection and manual value override for translated locale values.

Roma shows account setup: base locale, plan translation allowance, target locales, and readiness counts. Bob's preview dropdown is populated from complete translated locales that Tokyo lists for the saved instance. Account-enabled languages without translated values for the current content are absent from the dropdown.

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
  styles.css
  script.js
  script.{locale}.js
```

Generated files are output. Publish status is product state. If the instance is unpublished or a requested generated artifact is missing, the public request returns 404. The serving layer does not compose translations, inspect account policy, or repair stale language output on visitor requests.

## Prague

Prague website copy is not account-widget authoring truth. Prague page translations are page-owned content beside page JSON. Prague must not preserve or reintroduce account-widget localization storage vocabulary.

## Deleted Pre-GA Concepts

The following are not part of the active account-widget localization capability:

- Widget `localization.json`.
- `textPack`.
- `L10nOp`.
- Base snapshots/fingerprints as translation identity.
- Overlay status/readiness inside translated value bodies.
- User-authored translation layers.
- Locale-suffixed instance IDs.
- Selected-locale or selected-overlay pointers as product truth.
- Public serving from old `/l10n/widgets/**` truth as an identity authority.
- Instance-only public widget routes.
- Instance-only public render routes.
- Root `published/`, root `public/`, or root `l10n/` lookup folders as public localization authority.
