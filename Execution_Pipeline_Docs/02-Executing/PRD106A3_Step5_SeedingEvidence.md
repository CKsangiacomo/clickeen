# PRD106A3 Step 5 Seeding Evidence

Status: Green
Date: 2026-06-07

Existing accounts are seeded through the Tokyo account-default boundary.

Canonical key:

```text
accounts/{accountPublicId}/widget-defaults.json
```

Implemented boundary:

```text
GET /__internal/accounts/{accountPublicId}/widget-defaults
```

The route calls `readOrSeedAccountWidgetDefaults`. If the account document is
missing, Tokyo writes a new account defaults document seeded from:

```text
packages/widget-shell WIDGET_SHELL_FACTORY_DEFAULTS
+ tokyo product widget Core factory defaults
```

This is not a runtime factory fallback. Seeding happens at the account defaults
boundary. New instance creation will later require account defaults before it
creates source.

Verification:

```text
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/widget-shell validate
```
