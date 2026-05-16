# Overlay Architecture

STATUS: REFERENCE - MUST MATCH PRD 098 IDENTITY + PRD 099 STORAGE

PRD 098 is the active overlay identity and body truth. PRD 099 is the active physical account runtime storage truth. Older l10n/text-pack/readiness storage and PRD 098-era account-widget folder paths are pre-GA residue and must not be preserved as a compatibility system.

## Core Tenet

An overlay is a SKU-like product object. The `overlayId` is the only overlay identity.

There is no separate overlay hash, value name, content address, storage-path identity, or body-derived identity. Tokyo can manage overlays by ID the same way a warehouse manages products by SKU: the ID tells the system the account, widget codebook coordinate, instance, language coordinate, experiment coordinate, personalization coordinate, version, and checksum without opening the overlay body. The R2 path supplies ownership and containment; it does not create another identity.

## Fixed Layout

`overlayId` is fixed-width uppercase base36:

```txt
[account][widget][instance][language][experiment][personalization][version][checksum]
```

Segments:

| Segment | Width | Meaning |
| --- | ---: | --- |
| account | 8 | `accountPublicId` from Michael/Berlin account truth |
| widget | 3 | widget code from the shared widget codebook; metadata/codebook identity, not a storage locator |
| instance | 10 | compact instance ID minted by Tokyo-worker |
| language | 4 | language code from the shared Babel codebook |
| experiment | 3 | experiment coordinate, default `A01` |
| personalization | 3 | personalization coordinate, default `000` |
| version | 2 | version slot `00..99` |
| checksum | 2 | CRC-16/XMODEM typo/corruption guard over the first 33 chars |

Only `@clickeen/ck-contracts` parses, builds, and validates this ID.

## Physical Storage

Overlay objects live under the owning account instance:

```txt
accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
```

Selected overlay pointers for authoring/runtime selection live under the same instance:

```txt
accounts/{accountPublicId}/instances/{instanceId}/selected-overlays/{languageCode}/{experiment}/{personalization}.json
```

Published overlay objects are derived public-serving projection material and live only under the instance published projection:

```txt
accounts/{accountPublicId}/instances/{instanceId}/published/overlays/{overlayId}.json
```

`widgetCode` is encoded in `overlayId` because it is part of the shared overlay codebook. It is never required to locate instance storage and must not reintroduce `accounts/{accountPublicId}/widgets/{widgetCode}/...`.

## Object Body

The authoring overlay body is only values:

```json
{
  "v": 1,
  "values": {}
}
```

No account ID, instance ID, language, status, job state, readiness, base revision, fingerprint, storage path, or reason field belongs inside the overlay body. Those coordinates are in the ID, the account instance path, or the calling workflow.

## Primitive Value Rule

Every widget declares its primitive variable graph once. ToolDrawer, Copilot, Babel, Bob preview, Tokyo, and Venice consume that same declaration.

Locale/Babel v1 writes text primitive values only. Later value overlays for colors, fills, typography, layout, or other Dieter token values must still use the same primitive graph. No producer may invent paths outside the widget declaration.

The declaration lives in `tokyo/product/widgets/{widgetType}/spec.json`:

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

Repeatable declaration paths are extraction instructions only. Producer/runtime payloads use concrete paths such as `sections.0.faqs.0.question`.

## Single Overlay Resolver

PRD 098 resolves one overlay at a time:

```txt
resolveOverlay(baseConfig, overlayValues)
```

The resolver applies the exact value map to the exact base config. It does not accept overlay arrays, precedence stacks, status, freshness metadata, fallback values, or producer-specific shapes.

Missing required paths and extra producer paths are rejected by the producer boundary before an overlay object is stored. Unknown path segments such as `__proto__`, `constructor`, and `prototype` are rejected.

## Tokyo PBX Rule

Tokyo-worker is the PBX/control-plane switchboard. It validates IDs, writes exact objects, reads exact objects, and updates selected/published pointers. It does not decide product meaning, run translation orchestration, inspect overlay bodies to understand identity, or repair data it produced.

Roma orchestrates product flows. San Francisco produces text values. Tokyo stores. Venice serves published truth.
