# Overlay Architecture

Last updated: 2026-08-05

## Product Rule

An account instance has one saved source, one published root runtime, and zero
derived locale runtimes.

```text
one root runtime + one exact locale overlay = localized rendering
```

Translation changes locale overlay truth only. It must never create HTML, CSS,
JavaScript, publication state, or another delivery lifecycle for a locale.

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

1. validates the account, instance, publication state, exact package files,
   and locale coordinate;
2. lists stored overlay coordinates and rejects an invalid base-locale overlay;
3. reads and validates the exact requested overlay against saved content;
4. for a translated request, replaces the exact field-marked values in the
   stored `index.html` and sets `<html lang>`;
5. completes the public account and instance placeholders from the validated
   route;
6. rejects any remaining `__CK_PUBLIC_*__` placeholder and serves valid HTML
   through the exact public URL cache key.

The HTML continues to reference the single root `styles.css` and `runtime.js`.
`runtime.js` binds widget and shared behavior to the generated markup; it does
not apply overlays or render primary customer content. Missing overlays return
`404 Locale not available`. Corrupt overlays return `500 Locale data invalid`.
Neither condition falls back to the base language. Instance Save, Instance
translation writes/deletes, publication, and deletion operations purge only
the affected public URLs.

## Current Operations

| Operation | Authority |
| --- | --- |
| List/read/write/delete overlay values | Roma account route -> Tokyo-worker translation route |
| Generate translations | Bob command -> Roma -> Translation Agent -> exact Tokyo overlay writes |
| Remove an active language | Roma deletes that exact overlay from every account instance |
| Save instance source | Bob submits current config and exact three-file package -> Roma derives source artifacts -> Tokyo-worker stores both |
| Publish/unpublish | Tokyo-worker owns the single `serve-state.json` |
| Public localized read | Tokyo-worker reads the one root artifact and exact overlay |

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
| Base public response | root URL returns completed stored HTML whose absolute support-file URLs remain inside the Instance coordinate |
| Localized public runtime | root URL with `?locale=` contains translated text and root support URLs |
| Missing/corrupt locale | explicit 404/500; never base-language output |
| Storage invariant | zero instance objects outside `overlays/locales/` representing a locale runtime |
