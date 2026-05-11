# PRD 89 - Slice 4 Delete Boundary Atomicity

Status: Green
Date: 2026-05-11

## Scope

Slice 4 closes the account instance delete split left after PRD 88.

The product boundary is now:

```text
Roma DELETE /api/account/instance/{instanceId}
  -> Tokyo DELETE /__internal/renders/widgets/{instanceId}/saved.json
    -> deleteInstanceMirror(env, instanceId, accountId)
```

The Tokyo operation resolves the account/widget/instance location before deleting source objects, removes the published lookup, and rebuilds the account widget index.

## Changes

- Replaced Roma's split `Promise.all([saved delete, live delete])` cleanup with one call to `deleteAccountInstanceFromTokyo`.
- Reused Tokyo's existing `deleteInstanceMirror` operation for the internal saved-config DELETE boundary.
- Removed the saved-only `deleteSavedRenderConfig` helper so the legacy partial-delete primitive is no longer available.
- Kept `deleteLiveSurfaceFromTokyo` only for the explicit unpublish action, where live-only deletion is the product behavior.

## Verification

```bash
rg -n "deleteSavedConfigFromTokyo|deleteSavedRenderConfig|Promise\.all\(\[\s*delete|tokyo_saved_config_delete" roma tokyo-worker -g'*.ts' -g'*.tsx'
```

Result: no matches.

```bash
rg -n "deleteLiveSurfaceFromTokyo" roma -g'*.ts' -g'*.tsx'
```

Result: only the helper definition and the unpublish route remain.

```bash
node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Result: passed.

```bash
corepack pnpm --filter @clickeen/roma lint
```

Result: passed with no ESLint warnings or errors.

```bash
NEXT_PUBLIC_TOKYO_URL=http://127.0.0.1:4001 corepack pnpm --filter @clickeen/roma build
```

Result: passed.

Note: the first Roma build attempt without `NEXT_PUBLIC_TOKYO_URL` failed at the existing configuration gate before page data collection. The build was rerun with an explicit local Tokyo URL and passed.

## Exit Criteria

1. Published instance deletion removes `accounts/{accountId}/widgets/{widgetType}/{instanceId}/...` and `published/widgets/{instanceId}.json` through one Tokyo operation.
2. Repeating the Tokyo delete is idempotent because `deleteInstanceMirror` tolerates a missing source location, still deletes the published lookup, and rebuilds the account index.
3. Roma no longer races saved/source deletion against live lookup deletion.
