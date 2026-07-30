# @clickeen/ck-runtime-materializer

## Purpose

Pure builder for the one public root artifact of a saved widget instance.

## Contract

Input:

- compiled widget software;
- account/instance/base-locale coordinate;
- saved base state;
- optional resolved typography data;
- source/schema evidence.

Output:

```text
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

The root index contains a stable `CK_LOCALE_CONTEXT` marker. Tokyo-worker
injects a validated base or translated context into the HTML response. The one
root runtime applies any injected exact overlay synchronously before widget
modules initialize.

This package never accepts a requested non-base coordinate, reads storage,
writes storage, calls a model, or creates locale-derived files.

## Forbidden

- service/runtime imports;
- environment reads;
- storage/network operations;
- alternative artifact roots;
- silent path/value repair;
- base-language substitution for requested translated context.

## Commands

```bash
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/ck-runtime-materializer test
```
