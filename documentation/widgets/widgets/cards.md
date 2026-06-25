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
widget.html
widget.css
widget.client.js
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
```

## Shell Utilities

Cards uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher. Card visual surfaces
are Core-owned under `cards.*`.

Runtime requires these Core DOM hooks:

```text
[data-role="cards"]
[data-role="cards-core"]
```

`widget.client.js` registers as `cards`, validates `cards.*`, renders cards
into `cards-core`, applies shared Shell utilities, and binds `ck:state-update`
for the current instance id.

Runtime invariants:

- `cards.items[]` must contain 2-16 cards.
- `cards.items[]` must contain stable, unique item ids.
- Card `title` and `copy` are required non-empty values.
- `cards.items[].media.kind` is `none`, `icon`, or `image`.
- Image cards require `cards.items[].media.image.src`.
- Icon cards require a Dieter icon name.
- Linked-card treatment requires each rendered card link to have both href and label.
- Card action URLs are validated as empty, `#`, root-relative, `http(s)`,
  `mailto`, or `tel`.
- Card wrapper styling uses shared `CKSurface.applyCardWrapper`, not a
  widget-local surface helper.

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
Public page package serving depends on Roma writing real page packages.

## Verification

```bash
pnpm validate:widgets
```
