# Cards Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Cards renders a repeatable set of cards with text, media metadata, and optional
links inside the shared widget Shell.

## Source

```text
tokyo/product/widgets/cards/
```

Files:

```text
spec.json
editable-fields.json
limits.json
index.html
styles.css
runtime.js
```

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `cards` |
| display name | Cards |
| Core namespace | `cards.*` |
| `itemKey` | `cards.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

Core defaults live under:

```text
cards
typography
uiLabels
```

Core state families:

```text
cards.appearance
cards.betweenCards
cards.cardPadding
cards.columns
cards.customCardStyles
cards.gap
cards.items
cards.treatment
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
cards.items[].title
cards.items[].copy
cards.items[].media.imageAlt
cards.items[].link.label
```

`cards.items[]` entries carry stable `id` values in widget Core state.

## Limits

```text
items.group.small.max -> cards.items[]
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
```

## Shell Utilities

Cards uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher. Card visual surfaces
are Core-owned under `cards.*`.

Generated `index.html` contains every card and its customer content. Its stable
Core hooks are:

```text
[data-role="cards"]
[data-role="cards-core"]
```

`runtime.js` has no Widget-local interaction. Web Code Generator renders the
complete structured card set into `index.html`. Card wrapper styling is
generated from the shared Shell surface contract.

Treatment and layout state:

```text
cards.treatment -> cards|linked-cards|steps
cards.columns -> 2|3|4
cards.gap
cards.cardPadding
cards.betweenCards
cards.customCardStyles
cards.appearance.cardwrapper
```

## Clickeen Pages Usage

Cards appears in Clickeen Page source as a saved account widget instance
placement. Repeated card items remain widget Core state inside the instance.

## Verification

```bash
pnpm validate:widgets
```
