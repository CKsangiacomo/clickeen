# PRD 89 - Slice 7 Venice Cache And Route Residue Cleanup

Status: Green
Date: 2026-05-11

## Scope

Slice 7 verifies Venice only knows the current Tokyo account-instance public paths:

```text
/widget/{instanceId}
/renders/widgets/{instanceId}/...
/l10n/widgets/{instanceId}/...
```

The code change was made during Slice 2 because Slice 2's exit scan included Venice.

## Verification

```bash
rg -n "/l10n/instances|/renders/instances|/e/|/r/" venice --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

Result: no matches.

```bash
rg -n "renders/widgets|l10n/widgets|meta/live|config\.json|live/r\.json|cache" venice/lib/tokyo.ts venice/app -g'*.ts' -g'*.tsx' --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Result: current routes only.

```bash
corepack pnpm --filter @clickeen/venice build
```

Result: passed. Build output includes the current `/widget/[instanceId]`, `/renders/[...path]`, and `/l10n/[...path]` routes.

## Exit Criteria

1. Old `/l10n/instances` and `/renders/instances` matchers are gone.
2. Old `/e` and `/r` aliases are gone from Venice active code.
3. Venice builds with `/widget/[instanceId]` and current proxy routes.
