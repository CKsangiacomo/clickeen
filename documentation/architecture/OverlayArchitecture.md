# Account Instance Overlay Architecture

STATUS: REFERENCE - MUST MATCH PRD 88 RUNTIME

An overlay is derived data for one account-owned widget instance. It is not the base widget config and not Prague website copy.

## Active Overlay Type

The only active account-instance overlay type today is l10n:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/overlay.json
```

Rules:

- Overlay identity includes account, widget type, instance ID, overlay type, and locale.
- Locale is never encoded into the instance ID.
- The overlay must apply only to allowed text paths for the current base config.
- If an overlay is missing or stale, that locale is not ready. The runtime must not silently fall back and call it translated.

## What Is Not An Account Instance Overlay

- Visual styling is base config, not an overlay.
- GEO, audience, campaign, and personalization concepts are not storage folders in the current product.
- Prague page translations are website page copy, not account widget instance overlays.

Future overlay types require their own PRD that defines selector, allowlist, lifecycle, readiness, runtime composition, and policy ownership.
