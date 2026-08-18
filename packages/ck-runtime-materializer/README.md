# @clickeen/ck-runtime-materializer

## Purpose

Pure Publish builder for one complete public package of a saved Widget instance.

## Contract

Input:

- compiled widget software;
- account/instance/base-locale coordinate;
- saved base state;
- exact resolved typography resources.

Output:

```text
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

The builder renders the Widget's authored Mustache HTML and CSS from the exact
saved state. `index.html` contains the meaningful semantic document,
`styles.css` contains its exact shared and Core presentation, and `runtime.js`
contains only shared and Core visitor behavior. The public JavaScript receives
no editable state or locale overlay payload.

Tokyo-worker stores and serves these exact bytes. Its separate locale-serving
path applies an exact trusted translation overlay to the semantic content slots
already present in `index.html`; it does not ask this package or public
JavaScript to render the Widget again.

This package never accepts a requested non-base coordinate, reads storage,
writes storage, calls a model, or creates locale-derived files.

## Forbidden

- service/runtime imports;
- environment reads;
- storage/network operations;
- alternative artifact roots;
- fingerprints or discarded evidence;
- downstream validation of trusted Clickeen state or source artifacts;
- editable-state or locale payloads in public JavaScript;
- silent path/value repair;
- base-language substitution for requested translated context.

## Commands

```bash
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/ck-runtime-materializer test
```
