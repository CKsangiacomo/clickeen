# Runtime Profiles

Last updated: 2026-07-30

## Current Runtime Surfaces

| Surface | Runtime truth |
| --- | --- |
| Bob preview | compiled widget software plus in-memory editor state |
| Saved instance | one stored base `index.html`, `styles.css`, and `runtime.js` package |
| Localized saved instance | the same base package plus one exact stored overlay |

## Local Runtime Rule

Local app commands are isolated debugging only. Cloud-dev Pages and Worker
surfaces are deployment truth.

## Tokyo-worker Runtime Boundary

Tokyo-worker owns public instance delivery:

```text
/{accountPublicId}/{instanceId}
/{accountPublicId}/{instanceId}?locale={locale}
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

The locale query does not identify another artifact. It selects one exact
overlay for the base package. Tokyo-worker validates publication, base
fingerprint, locale coordinate, overlay shape, and saved-field equality before
returning localized HTML.

## Storage Runtime

```text
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  styles.css
  runtime.js
  serve-state.json
  overlays/locales/{locale}.json
```

The base index contains a stable locale-context marker. Tokyo-worker injects
base or translated context into the response. Package support URLs never vary by
locale. Runtime initialization is synchronous: the exact overlay is applied
before widget modules execute.

## Failure Rule

- unpublished instance: `404`;
- missing requested overlay: `404 Locale not available`;
- corrupt requested overlay or invalid root context marker: `500 Locale data invalid`;
- no requested non-base locale may render base content.

## Verification

- Git state: local `main`, tracking branch, and GitHub `main`.
- Worker state: GitHub Actions deploy for the exact SHA.
- Base runtime: base and locale requests reference identical support URLs.
- Overlay behavior: changing one overlay changes only that locale response.
- R2: exactly one base artifact set and overlay JSON; no locale-derived runtime
  objects.
