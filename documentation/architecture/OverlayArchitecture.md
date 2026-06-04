# Overlay Architecture

STATUS: LEGACY EVIDENCE - SUPERSEDED BY PRD 103 TRANSLATED-LOCALE OPERATIONS AND PRD 103J GENERIC WIDGET TRANSLATION

PRD 103_02 / 103J NOTE: this document records the old overlay-object model as implementation evidence only. `overlayId`, selected overlay pointers, overlay inventories, physical overlay files, Roma save-follow-up translation, and FAQ-only translation must not be exposed as Roma/Bob/San Francisco product contracts. The surviving product contract is translated-locale values owned by Tokyo operations, generated from widget-generic editable-field contracts.

Older l10n/text-pack/readiness storage and PRD 098-era account-widget folder paths are pre-GA residue and must not be preserved as a compatibility system.

## Deleted Core Tenet

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
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Public visitor package files are stored separately as the three-file widget package:

```txt
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
```

`widgetCode` is never required to locate instance storage and must not reintroduce `accounts/{accountPublicId}/widgets/{widgetCode}/...`. Locale is a product parameter on translated value operations, not a storage identity exposed to callers.

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

Every widget declares its primitive variable graph once. ToolDrawer, Copilot, Babel, Bob preview, Tokyo, and San Francisco consume that same declaration.

Locale/Babel v1 writes text primitive values only. Later value overlays for colors, fills, typography, layout, or other Dieter token values must still use the same primitive graph. No producer may invent paths outside the widget declaration.

The declaration lives in `tokyo/product/widgets/{widgetType}/editable-fields.json`:

```json
{
  "v": 1,
  "widgetType": "faq",
  "fields": [
    { "path": "header.title", "label": "Title", "type": "richtext", "role": "header-title" },
    { "path": "sections[].faqs[].question", "label": "Question", "type": "string", "role": "faq-question" }
  ]
}
```

Repeatable declaration paths are extraction instructions only. Producer/runtime payloads use concrete paths such as `sections.0.faqs.0.question`.

## Single Translated-Value Resolver

PRD 103 resolves one translated value map at a time:

```txt
resolveTranslatedValues(baseConfig, translatedValues)
```

The resolver applies the exact translated value map to the exact base config. It does not accept arrays, precedence stacks, status, freshness metadata, fallback values, or producer-specific shapes.

Missing required paths and extra producer paths are rejected by the producer boundary before translated values are stored. Unknown path segments such as `__proto__`, `constructor`, and `prototype` are rejected.

## Tokyo PBX Rule

Tokyo-worker is the PBX/control-plane switchboard. It validates IDs, writes exact translated values, and reads exact translated values. It does not decide product meaning, inspect storage bodies to understand identity, synthesize desired-locale availability, or repair data it produced.

Historical PRD 098 flow: Roma orchestrated product flows, San Francisco produced text values after Save, Tokyo stored them, and public serving read generated browser files. Current PRD 103J translation flow starts from Bob's Translations panel Generate action, routes through Roma to Tokyo, and uses widget-generic saved text fields.
