# Clickeen Account Widget Localization Protocol

STATUS: REFERENCE - PRD 88 CURRENT MODEL

This document describes only the active account widget localization protocol. Older multi-layer/future personalization ideas are not runtime truth.

## Product Boundary

Builder edits one account-owned widget instance in the account base locale.

Translation is async follow-up work after save. It writes l10n overlays for requested locales.

## Storage

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/
  config.json
  overlays/l10n/{locale}/overlay.json
  published/config.json
```

Public serving discovers the owner through:

```txt
published/widgets/{instanceId}.json
```

## Runtime Rules

- Locale is not identity.
- `instanceId` is stable and generated.
- L10n overlays are set-only account-instance artifacts.
- Prague page translations are separate website copy and do not live under account instance overlays.
- Missing l10n overlay means that locale is unavailable, not silently translated.
- Venice serves only published Tokyo bytes.

## Translation Execution

Tokyo-worker owns account storage and queue state.

San Francisco is only the private worker-bound translation executor. It receives approved text items and returns set-only locale ops. It does not own account storage, widget config, allowlists, publication, or locale policy.
