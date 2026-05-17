# Localization Capability

STATUS: REFERENCE - PRD 098 MODEL + PRD 099 PUBLIC STORAGE

Localization is the first Babel application of the overlay primitive. It translates widget-owned text primitives into locale overlay objects.

## Core Principle

- Locale is a runtime parameter for serving.
- Locale is not base instance identity.
- Locale is encoded in `overlayId` because an overlay is a SKU-like value object.
- The overlay body is only `{ "v": 1, "values": { ... } }`.

There is no account-widget `localization.json`, no layer sidecar, no text pack, no base-fingerprint overlay identity, and no compatibility bridge to the old pre-GA l10n model.

## Canonical Locale Registry

`packages/l10n/locales.json` is the canonical registry of supported locale tokens and labels.

Use `@clickeen/l10n` only for locale data helpers:

- `normalizeLocaleToken`
- `localeCandidates`
- `normalizeCanonicalLocalesFile`
- `resolveLocaleLabel`

`@clickeen/l10n` must not own widget path extraction or overlay identity.

## Account Locale Policy

Account-mode effective localization is:

```txt
entitlements + account active locales + saved widget primitive graph
```

Entitlement keys:

- `l10n.locales.max`
- `l10n.versions.max`

Account active locales are managed in Roma Settings. Builder edits only one base-locale widget at a time; translation is async follow-up work after save.

## Widget Text Primitive Source

Each widget declares translatable text in `spec.json`:

```json
{
  "overlays": {
    "v": 1,
    "text": [
      { "path": "header.title", "label": "Title" },
      { "path": "sections[].faqs[].question", "label": "Question" },
      { "path": "sections[].faqs[].answer", "label": "Answer" }
    ]
  }
}
```

Collection declarations are never sent to producers. They are expanded against the saved config into concrete paths such as:

```txt
sections.0.faqs.0.question
sections.0.faqs.0.answer
```

## Babel Save Flow

1. User saves one widget instance in Bob.
2. Roma saves the base config through the account product boundary.
3. Roma orchestrates Babel follow-up for account active locales.
4. San Francisco receives concrete text primitive paths and base values.
5. San Francisco returns concrete translated text values.
6. The receiving boundary rejects missing or extra paths with the path named.
7. Tokyo-worker stores an exact overlay object under `overlays/{overlayId}.json`.
8. Published runtime projection points to exact overlay IDs when public serving should expose them.

No step repairs values, drops paths, guesses paths, or scans widget JSON to rediscover meaning.

Base save success is independent from language production. If Czech fails and Italian succeeds, Roma returns base save success with per-language follow-up details and Tokyo stores the successful Italian overlay. The failed language has no selected overlay update.

## Builder Preview

The Builder Translations panel is read-only inspection of locale overlays.

Roma shows only account setup: base locale, plan translation allowance, and active account translations. Bob's preview dropdown is populated only from complete locale overlay files that Tokyo lists for the saved instance. Account-enabled languages without a complete overlay file are absent from the dropdown.

When a locale overlay is selected, Bob preview resolves:

```txt
baseConfig + one overlay values object
```

Partial overlay values are not stored, listed, read, or selectable. Tokyo validates overlay values against the saved instance config plus widget text primitive declaration before accepting them. Stale old values must not be shown as if they are current.

## Public Static Locale Serving

PRD 100 removes runtime locale composition from public visitor traffic.

The public serving coordinate is:

```txt
accountPublicId + instanceId
```

The public static route is:

```txt
https://clk.live/{accountPublicId}/{instanceId}
```

For a locale build, the translation agent writes overlay objects under the instance. The coding agent consumes `instance.json` plus overlays after save and writes generated locale browser files directly under the same instance folder:

```txt
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  {locale}.html
  styles.css
  script.js
```

If the generated locale file does not exist, that public locale URL returns 404. The serving layer does not compose overlays, inspect account policy, or repair stale language output on visitor requests.

## Prague

Prague website copy is not account-widget authoring truth. PRD 098F decides whether Prague routes through the Venice/account-widget overlay runtime or keeps a separate website-copy pipeline. It must not silently preserve old account-widget l10n concepts.

## Deleted Pre-GA Concepts

The following are not part of the active account-widget localization capability:

- Widget `localization.json`.
- `textPack`.
- `L10nOp`.
- Base snapshots/fingerprints as overlay identity.
- Overlay status/readiness inside overlay bodies.
- User-authored translation layers.
- Locale-suffixed instance IDs.
- Public serving from old `/l10n/widgets/**` truth as an identity authority.
- Instance-only public widget routes.
- Instance-only public render routes.
- Root `published/`, root `public/`, or root `l10n/` lookup folders as public localization authority.
