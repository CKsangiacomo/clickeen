# Runtime Profiles

Last updated: 2026-08-05

## Current Runtime Surfaces

| Surface | Runtime truth |
| --- | --- |
| Bob preview | Web Code Generator output for the current valid in-memory editor state |
| Saved instance | one stored root `index.html`, `styles.css`, and `runtime.js` |
| Localized saved instance | the same root artifact plus one exact stored overlay |
| Saved Page | one direct stored `index.html`, `styles.css`, and `runtime.js` plus source, serving overlays, authoring overlays, and publication state |

## Local Runtime Rule

Local app commands are isolated debugging only. Cloud-dev Pages and Worker
surfaces are deployment truth.

## Tokyo-worker Runtime Boundary

Tokyo-worker owns public Instance and Page delivery:

```text
/{accountPublicId}/{instanceId}
/{accountPublicId}/{instanceId}?locale={locale}
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
/{accountPublicId}/pages/{pageId}
/{accountPublicId}/pages/{pageId}/{locale}
/{accountPublicId}/pages/{pageId}/styles.css
/{accountPublicId}/pages/{pageId}/runtime.js
```

The locale query does not identify another artifact. It selects one exact
overlay for the root artifact. Tokyo-worker validates publication, exact
package files, locale coordinate, overlay shape, and saved-field equality
before returning localized HTML.

The stable Page coordinate selects only from the saved public locale set and
redirects with `no-store`. The base exact-locale coordinate uses stored base
index values; a non-base coordinate selects one entry in root `overlays.json`,
not another Page artifact.

## Storage Runtime

```text
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  styles.css
  runtime.js
  serve-state.json
  overlays/locales/{locale}.json

accounts/{accountPublicId}/pages/{pageId}/
  source.json
  serve-state.json
  overlays/locales/{locale}.json
  overlays.json
  index.html
  styles.css
  runtime.js
```

The root index contains exact field markers and may contain public placeholders
when generated semantics or attribution require public coordinates.
Tokyo-worker rewrites marked values and `<html lang>` for a translated request,
then completes any public account and instance placeholders for both base and
translated responses. Any remaining public placeholder fails closed. Root
support URLs never vary by locale. `runtime.js` binds behavior to the generated
markup; it does not apply locale overlays. Completed Instance/Page HTML uses the
exact response URL as its CDN cache key. Support files are shared across
locales. Instance Save/translation/publication/deletion and Page Save while
published/Publish/Unpublish/Delete purge only affected public HTML and
support-file URLs.

## Failure Rule

- unpublished instance: `404`;
- unpublished Page: `404`;
- missing requested overlay: `404 Locale not available`;
- corrupt requested overlay: `500 Locale data invalid`;
- malformed root Page `overlays.json`: every Page route returns `500 Page unavailable`;
- missing Page exact locale from an otherwise valid root: `404 Locale not available`;
- failure while completing selected Page HTML: `500 Page locale data invalid`;
- incomplete public placeholder completion: `500 Public HTML invalid`;
- no requested non-base locale may render base content.

## Verification

- Git state: local `main`, tracking branch, and GitHub `main`.
- Worker state: GitHub Actions deploy for the exact SHA.
- Root runtime: base and locale requests reference identical root support URLs.
- Overlay behavior: changing one overlay changes only that locale response.
- R2: exactly one root artifact set and overlay JSON; no locale-derived runtime
  objects.
- Page runtime: stable redirect selects a saved locale, exact-locale HTML is
  complete before JavaScript, and all locales share one CSS/runtime pair.
