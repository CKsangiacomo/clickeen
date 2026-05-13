# PRD 089 Slice 2 - Preview, Dev Server, And Runtime L10n Route Closure

Status: Executed - green
Date: 2026-05-11

## Changes

Updated preview l10n to read the current account-widget overlay route:

```text
/l10n/widgets/{instanceId}/{locale}/overlay.json
```

Updated `tokyo/dev-server.mjs` to proxy `/l10n/widgets/...` and `/l10n/v/{version}/widgets/...` instead of removed `/l10n/instances/...` paths.

Removed old Venice cache matchers for `/l10n/instances/...` and `/renders/instances/...` while updating cache recognition to current `/l10n/widgets/...` and `/renders/widgets/...` paths. This satisfies the Slice 2 exit scan that includes Venice; Slice 7 should be a verification pass.

## Verification

```bash
rg -n "/l10n/instances|/l10n/v/.*/instances|/renders/instances" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

Result: no active runtime-code matches.

```bash
node --check tokyo/product/widgets/shared/previewL10n.js && node --check tokyo/dev-server.mjs
```

Result: both files parse.

```bash
corepack pnpm --filter @clickeen/venice build
```

Result: passed. Venice has no `lint` or `typecheck` package scripts, so build was used for TypeScript validation.

```bash
rg -n "publicId|public_id|data-ck-public-id|CK_WIDGET\\.publicId" tokyo/product/widgets bob roma venice prague packages --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

Result: still no active product-code matches after Slice 2.

## Gate

Slice 2 is complete.
