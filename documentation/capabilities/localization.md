# Localization Capability

Last updated: 2026-07-30

## Product Contract

Clickeen localization is overlay-native:

```text
one saved base source
+ one exact overlay per translated locale
+ one published root runtime
= localized public widget
```

Translation is content work. It does not create another widget artifact,
publication state, delivery file, or cache lifecycle.

## Code Authority

| Concern | Authority |
| --- | --- |
| Account locale policy | Roma account locale routes and account storage |
| Translation command | Bob `TranslationsPanel` -> Roma translation route |
| Translation operation | Translation Agent -> San Francisco |
| Saved text extraction and exact overlay validation | Tokyo-worker account translation domain |
| Overlay storage | Tokyo R2 `overlays/locales/{locale}.json` |
| Bob translated preview | translated-value primitives over saved base state |
| Public localized serving | Tokyo-worker root index response plus root runtime |
| Root artifact construction | `@clickeen/ck-runtime-materializer` |

## Authority Chain

```text
Roma current account/session
-> accountPublicId
-> saved account instance
-> exact locale coordinate
-> Tokyo-worker
-> accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Public serving adds the single publication coordinate:

```text
serve-state.json
-> root index/styles/runtime fingerprint
-> exact requested overlay
-> injected locale context
```

## Locale Policy

- The account base locale is source authority.
- Active non-base locales are translation targets allowed by account policy.
- Generate Translations requests every currently active non-base locale.
- Removing an active locale deletes its exact overlay from every account
  instance. Each completed and failed deletion coordinate remains visible.
- Changing locale settings never creates or rebuilds public runtime files.

## Source Text

`instance.content.json` owns the current saved translatable field set. Fields
are concrete saved paths, including concrete array indexes. Translation
responses must return one string for every current path and no other path.

Human-authored base text remains human source authority. Agents translate it;
they do not silently rewrite the base source.

## Generate Translations

1. Bob requires a saved, clean instance and at least one active non-base locale.
2. Roma resolves current account/session and entitlement truth.
3. Roma asks the Translation Agent for exact requested locale results.
4. San Francisco translates the supplied saved text items.
5. Tokyo-worker accepts only complete exact overlay value maps and writes each
   overlay.
6. Roma returns:

   ```text
   requestedLocales
   translatedLocales
   failedLocales
   ```

7. Bob reports those outcomes and refreshes translated preview state.

No later artifact step exists.

## Overlay Contract

Storage:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Body:

```json
{
  "values": {
    "header.title": "Translated title"
  }
}
```

An editor-authorized exact-value write uses
`PUT /api/account/instances/{instanceId}/translations/{locale}`. The body must
contain the complete `values` map for current saved text fields. Base-locale
overlays, missing paths, and extra paths fail; the write has no runtime-artifact
side effect.

Validation is exact against current saved content. Missing paths, unexpected
paths, non-string values, malformed documents, and invalid locale coordinates
fail. Stored corruption is not normalized or treated as missing.

## Bob Preview

Bob reads saved overlays through Roma and resolves them over the current saved
base state with `resolveTranslatedValues`. Preview state is not public artifact
truth and never writes storage.

## Public Serving

Canonical URLs:

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
```

For an index request, Tokyo-worker verifies the published instance and one root
artifact. It lists overlay coordinates, reads and validates the exact requested
overlay, injects a locale context into the stored root index, and returns HTML
with `no-store`. That HTML references only root `styles.css` and `runtime.js`.

The root runtime applies injected values synchronously before widget modules
initialize. A missing requested overlay returns `404 Locale not available`. A
corrupt overlay returns `500 Locale data invalid`. Base content is never
presented as a requested non-base locale.

## Operator Recipes

### Generate one instance

Use Bob’s Generate Translations command or the authenticated Roma instance
translation route. Confirm the returned requested/translated/failed sets
reconcile exactly.

### Inspect overlay truth

1. Run `pnpm cf:preflight`.
2. Read the exact `overlays/locales/{locale}.json` object.
3. Compare its path set with `instance.content.json`.
4. Confirm no root source or artifact object changed unless a separate instance
   save occurred.

### Verify public localization

1. Confirm the instance is published.
2. Open the base URL and the same URL with `?locale={locale}`.
3. Confirm translated text and `<html lang>` on the locale response.
4. Confirm both responses reference identical root stylesheet/runtime URLs.
5. Confirm missing and corrupt overlays fail explicitly.

## Failure Semantics

- Requested locale outcomes are exhaustive.
- Partial translation success is reported as partial.
- Activity transport is never result truth.
- Missing overlay and corrupt overlay are distinct.
- No generated value substitutes for missing source truth.
- Public reads never write, heal, regenerate, or call an agent.

## Verification Matrix

| Concern | Proof |
| --- | --- |
| Account policy | Roma locale route response |
| Saved text set | Tokyo instance content |
| Overlay bytes | exact R2 read after `pnpm cf:preflight` |
| Translation outcome | Roma requested/translated/failed sets |
| Bob preview | exact overlay values displayed over saved source |
| Root artifact | root R2 index/styles/runtime fingerprint |
| Localized runtime | root URL with `?locale=` and translated output |
| Negative storage invariant | no instance locale-derived HTML/CSS/JS objects |
