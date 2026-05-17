# Clickeen Babel Protocol

STATUS: REFERENCE - MUST MATCH PRD 098 IDENTITY + PRD 099 STORAGE

Babel is Clickeen's locale overlay application. It is not a separate translation schema, a runtime fallback system, or a storage locator layer.

## Product Boundary

Builder edits one account-owned widget instance in the account base locale.

After save, Roma orchestrates locale work from the current saved config. San Francisco receives concrete text primitive values and returns concrete translated text primitive values. Tokyo-worker stores exact overlay objects under the owning account instance and writes public copies only into the instance published projection. Venice serves published projection truth.

## Source Of Text Truth

Each widget declares its primitive variable graph once in:

```txt
tokyo/product/widgets/{widgetType}/spec.json
```

The active contract is:

```json
{
  "overlays": {
    "v": 1,
    "text": [
      { "path": "header.title", "label": "Title" },
      { "path": "sections[].faqs[].question", "label": "Question" }
    ]
  }
}
```

Repeatable declaration paths are only extraction instructions inside the product boundary. Producer payloads always contain concrete paths:

```json
{
  "sections.0.faqs.0.question": "What rooms do you offer?"
}
```

No producer receives wildcard, glob, template, or sidecar paths.

## Exact Producer Contract

For a given saved config and widget primitive graph:

1. Roma extracts the required concrete text primitive paths from the saved config and widget primitive graph.
2. San Francisco receives exactly those paths and their current base values.
3. San Francisco returns exactly those paths and translated values.
4. Roma rejects the response if any required path is missing.
5. Roma rejects the response if any undeclared path is present.
6. Tokyo-worker validates the same value map at the storage boundary before writing the overlay object.
7. The rejection names the concrete offending path.

The system does not normalize, drop, repair, coerce, or infer producer output.

## Overlay Object And Storage

The result is stored as a PRD 098 overlay object:

```json
{
  "v": 1,
  "values": {
    "header.title": "Domande frequenti",
    "sections.0.faqs.0.question": "Che stanze offrite?"
  }
}
```

The authoring object lives at:

```txt
accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
```

Selected overlay pointers live at:

```txt
accounts/{accountPublicId}/instances/{instanceId}/selected-overlays/{languageCode}/{experiment}/{personalization}.json
```

Published public copies live at:

```txt
accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
```

The body contains only values. It does not contain locale, account, instance, readiness, job state, base revision, fingerprint, hash identity, or storage path. Identity lives in `overlayId`; ownership and containment live in the account instance path. `widgetCode` is codebook metadata inside `overlayId`, not an R2 path segment for locating storage.

## Runtime Resolution

Babel v1 uses a single overlay at a time:

```txt
resolvedConfig = resolveOverlay(baseConfig, overlayValues)
```

No multi-layer precedence resolver is part of this protocol. A/B, geo, personalization, or stacked overlays require a later PRD.

## Tokyo PBX Rule

Tokyo-worker validates `overlayId`, stores exact overlay objects, reads exact overlay objects, and projects selected/published overlay IDs.

Tokyo-worker must not:

- Orchestrate San Francisco work.
- Inspect overlay bodies to understand identity.
- Repair values it produced or accepted.
- Preserve old l10n path shapes.
- Preserve old `accounts/{accountPublicId}/widgets/{widgetCode}/...` storage shapes.

## Deleted Pre-GA Model

The following are not active product truth:

- Widget `localization.json`.
- `textPack`.
- `L10nOp`.
- Base snapshot/fingerprint identity for account-widget overlays.
- Readiness/status fields inside overlay bodies.
- Compatibility readers for old overlay paths.
