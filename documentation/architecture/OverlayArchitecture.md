# Overlay Architecture

Last updated: 2026-07-30

## Product Rule

An account instance has one saved source, one published root runtime, and zero
derived locale runtimes.

```text
one root runtime + one exact locale overlay = localized rendering
```

Translation changes locale overlay truth only. It must never create HTML, CSS,
JavaScript, publication state, fingerprints, or another delivery lifecycle for
a locale.

## Storage

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  serve-state.json
  index.html
  styles.css
  runtime.js
  overlays/
    locales/
      {locale}.json
```

The overlay body is exact:

```json
{
  "values": {
    "header.title": "Translated text"
  }
}
```

There is no instance-level locale artifact subtree.

## Page Authoring Overlays

Page authoring uses the same separate exact-file law:

```text
accounts/{accountPublicId}/pages/{pageId}/
  source.json
  overlays/
    locales/
      {locale}.json
```

`source.json` owns `baseLocale` and the selected locale list. Each non-base
locale is one exact Page overlay file; Page overlays are not stored inline in
`source.json`. This lets Translation Agent write locales independently without
one concurrent result replacing another.

Page templates have no locales and no locale overlay files. Page compilation
and its generated serving files belong to later 127 slices and are not current
runtime behavior.

## Field Authority

`instance.content.json` owns the current saved text-field set. Every overlay
must contain exactly that set of concrete paths, with string values. Missing,
unexpected, malformed, or non-text values are corruption and fail visibly.
They are never filtered, repaired, or treated as absence.

## Runtime Rule

The canonical public selection is:

```text
/{accountPublicId}/{instanceId}?locale={locale}
```

Tokyo-worker:

1. validates the account, instance, publication state, root artifact
   fingerprint, and locale coordinate;
2. lists the stored overlay coordinates for the locale switcher;
3. reads and validates the exact requested overlay against saved content;
4. injects that locale context into the stored root `index.html`;
5. serves the response with `no-store`.

The HTML continues to reference the single root `styles.css` and `runtime.js`.
The root runtime applies the injected overlay synchronously before widget
modules initialize. Missing overlays return `404 Locale not available`.
Corrupt overlays return `500 Locale data invalid`. Neither condition falls back
to the base language.

## Current Operations

| Operation | Authority |
| --- | --- |
| List/read/write/delete overlay values | Roma account route -> Tokyo-worker translation route |
| Generate translations | Bob command -> Roma -> Translation Agent -> exact Tokyo overlay writes |
| Remove an active language | Roma deletes that exact overlay from every account instance |
| Save instance source | Roma -> Tokyo-worker; updates source and the one root runtime only |
| Publish/unpublish | Tokyo-worker owns the single `serve-state.json` |
| Public localized read | Tokyo-worker reads the one root artifact and exact overlay |

The same Generate translations operation accepts an Instance or Page target.
For a Page, it writes only the translated Page metadata values to the exact Page
locale overlay path. It does not compile or publish the Page.

## Failure Semantics

- Generation success means every requested locale has an explicit translated or
  failed outcome. It never includes artifact work.
- Partial translation failure stays partial and names the exact failed locales.
- Overlay deletion reports every completed and failed instance/locale
  coordinate.
- Missing requested overlay is absence; malformed stored overlay is corruption.
  They are not interchangeable.
- Public localization never calls a model, writes storage, regenerates source,
  or depends on a test/probe.

## Verification

| Concern | Owner-of-truth verification |
| --- | --- |
| Overlay bytes | `pnpm cf:preflight`, then exact R2 object read |
| Translation command | Roma response contains requested/translated/failed locale truth only |
| Base public runtime | root URL loads root index, stylesheet, and runtime |
| Localized public runtime | root URL with `?locale=` contains translated text and root support URLs |
| Missing/corrupt locale | explicit 404/500; never base-language output |
| Storage invariant | zero instance objects outside `overlays/locales/` representing a locale runtime |
