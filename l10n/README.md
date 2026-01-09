# Clickeen-Owned Localization Overlays (L10N)

This folder is the **source** for Clickeen-owned localization overlays.

Output is built into `tokyo/l10n/**` so it can be cached on the Tokyo CDN (software plane).

## Instance overlays

Source path:
- `l10n/instances/<publicId>/<locale>.ops.json`

Built output:
- `tokyo/l10n/instances/<publicId>/<locale>.<hash>.ops.json`
- `tokyo/l10n/manifest.json`

Overlay format:
```json
{
  "v": 1,
  "baseUpdatedAt": "2026-01-08T00:00:00.000Z",
  "ops": [
    { "op": "set", "path": "headline", "value": "..." }
  ]
}
```

Rules:
- Only `set` ops are allowed.
- Locale is a runtime parameter; it must never be encoded into `publicId`.
- `baseUpdatedAt` is optional; when present, runtime applies the overlay only if it matches the base instance `updatedAt`.

