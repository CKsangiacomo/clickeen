# PRD106A3 Step 5 Seeding Evidence

Status: Superseded by PRD 107
Date: 2026-06-07

PRD 107 deleted the read-or-seed account-default workflow. Existing accounts
must already have account widget defaults before instance creation; missing or
invalid defaults fail visibly at the account defaults boundary.

Canonical key:

```text
accounts/{accountPublicId}/widget-defaults.json
```

Strict read boundary:

```text
GET /__internal/accounts/{accountPublicId}/widget-defaults
```

The route calls `readAccountWidgetDefaults`. If the account document is missing
or malformed, Tokyo returns `tokyo.widgetDefaults.missing` or
`tokyo.widgetDefaults.invalid` and does not write repaired defaults.

Verification:

```text
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/widget-shell typecheck
```
