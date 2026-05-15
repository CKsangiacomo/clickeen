# Overlay Architecture

STATUS: REFERENCE - MUST MATCH PRD 098

PRD 098 is the active overlay truth. Older l10n/text-pack/readiness storage is pre-GA residue and must not be preserved as a compatibility system.

## Core Tenet

An overlay is a SKU-like product object. The `overlayId` is the only overlay identity.

There is no separate overlay hash, value name, content address, or body-derived identity. Tokyo can manage overlays by ID the same way a warehouse manages products by SKU: the ID tells the system the account, widget, instance, language coordinate, experiment coordinate, personalization coordinate, version, and checksum without opening the overlay body.

## Fixed Layout

`overlayId` is fixed-width uppercase base36:

```txt
[account][widget][instance][language][experiment][personalization][version][checksum]
```

Segments:

| Segment | Width | Meaning |
| --- | ---: | --- |
| account | 8 | `accountPublicId` from Michael/Berlin account truth |
| widget | 3 | widget code from the shared widget codebook |
| instance | 10 | compact instance ID minted by Tokyo-worker |
| language | 4 | language code from the shared Babel codebook |
| experiment | 3 | experiment coordinate, default `A01` |
| personalization | 3 | personalization coordinate, default `000` |
| version | 2 | version slot `00..99` |
| checksum | 2 | CRC-16/XMODEM typo/corruption guard over the first 33 chars |

Only `@clickeen/ck-contracts` parses, builds, and validates this ID.

## Object Body

Overlay objects live at:

```txt
overlays/{overlayId}.json
```

The body is only values:

```json
{
  "v": 1,
  "values": {}
}
```

No account ID, instance ID, language, status, job state, readiness, base revision, fingerprint, or reason field belongs inside the overlay body. Those coordinates are in the ID or in the calling workflow.

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
