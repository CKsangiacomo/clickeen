# Split Carousel Media Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Split Carousel Media renders a split section with carousel media items inside
the shared widget Shell.

## Source

```text
tokyo/product/widgets/split-carousel-media/
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
| `widgetname` | `split-carousel-media` |
| display name | Split Carousel Media |
| Core namespace | `splitCarouselMedia.*` |
| `itemKey` | `split-carousel-media.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

Core defaults live under:

```text
splitCarouselMedia
uiLabels
```

Core state families:

```text
splitCarouselMedia.appearance
splitCarouselMedia.carousel
splitCarouselMedia.items
splitCarouselMedia.media
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
splitCarouselMedia.items[].alt
```

Valid `splitCarouselMedia.items[]` runtime state requires stable, unique,
non-empty `id` values.

## Limits

```text
items.group.small.max -> splitCarouselMedia.items[]
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
```

## Shell Utilities

Split Carousel Media uses the shared Shell for Header, Header CTA, Stage/Pod,
Core size, typography, branding, social share, and locale switcher. Carousel
media items belong to `splitCarouselMedia.*`.

Runtime requires these Core DOM hooks:

```text
[data-role="split-carousel-media"]
[data-role="split-carousel-media-core"]
```

`widget.client.js` registers as `split-carousel-media`, validates
`splitCarouselMedia.*`, renders slides into `split-carousel-media-core`, applies
shared Shell utilities, and binds `ck:state-update` for the current instance id.

Runtime invariants:

- `splitCarouselMedia.items[]` must contain 2-6 visuals.
- Item ids must be stable and unique.
- Media kind is `none`, `image`, or `video`.
- Empty media state must not include populated image/video buckets.
- Media source values must be non-empty and accepted as relative, absolute-path,
  or `http(s)` URLs.
- Video media may include a poster and defaults muted, loop, autoplay, and
  playsinline behavior unless explicitly disabled by state.
- Carousel controls, autoplay, loop, transition, and interval behavior belong to
  `splitCarouselMedia.carousel`.
- Carousel transition is `slide` or `fade`; autoplay interval is 2000..12000ms.
- Applying new state resets the active slide to the first rendered item.
- Auto core size uses a 16:9 shape with a 320px minimum height in current CSS.
- Card wrapper styling uses shared `CKSurface.applyCardWrapper`.

## Clickeen Pages Usage

Split Carousel Media appears in Clickeen Page source as a saved account widget
instance placement. Media fill objects remain in instance state. Uploaded files
are account assets, but runtime validates source URL shape; it does not rely on
account-asset identity alone. Public page package serving depends on Roma
writing real page packages.

## Verification

```bash
pnpm validate:widgets
```
