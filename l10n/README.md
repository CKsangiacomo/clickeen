# Clickeen-Owned Localization Overlays (L10N)

This folder is the **source** for Clickeen-owned localization overlays.

Output is built into `tokyo/l10n/**` so it can be cached on the Tokyo CDN (software plane).

## Instance overlays

Source path:
- `l10n/instances/<publicId>/<layer>/<layerKey>.ops.json`

Built output:
- `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`
No global manifest is produced; consumers use deterministic baseFingerprint paths.

Overlay format:
```json
{
  "v": 1,
  "baseFingerprint": "sha256-hex",
  "baseUpdatedAt": "2026-01-08T00:00:00.000Z",
  "ops": [
    { "op": "set", "path": "headline", "value": "..." }
  ]
}
```

Rules:
- Only `set` ops are allowed.
- `publicId` is locale-free; locale is a runtime layer key.
- `baseFingerprint` is required; runtime applies the overlay only when it matches the base instance config.
- `baseUpdatedAt` is metadata only.
