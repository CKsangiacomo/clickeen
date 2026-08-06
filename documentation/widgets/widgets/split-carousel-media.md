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
index.html
styles.css
runtime.js
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
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
```

## Shell Utilities

Split Carousel Media uses the shared Shell for Header, Header CTA, Stage/Pod,
Core size, typography, branding, social share, and locale switcher. Carousel
media items belong to `splitCarouselMedia.*`.

Generated `index.html` contains every slide and its media markup. Its stable
Core hooks include:

```text
[data-role="split-carousel-media"]
[data-role="split-carousel-media-core"]
```

`runtime.js` registers as `split-carousel-media` through `CKWidgetRuntime` and
binds controls, autoplay, and video behavior to generated slides. It does not
render slides from config or accept generic state updates.

Runtime behavior contract:

- Video media may include a poster and defaults muted, loop, autoplay, and
  playsinline behavior unless explicitly disabled by state.
- Carousel controls, autoplay, loop, transition, and interval behavior belong to
  `splitCarouselMedia.carousel`.
- Runtime requires at least two generated slides, a `slide` or `fade`
  transition, and a finite positive autoplay interval.
- Auto core size uses a 16:9 shape with a 320px minimum height in current CSS.
- Card wrapper styling is generated from the shared Shell surface contract.

## Clickeen Pages Usage

Split Carousel Media appears in Clickeen Page source as a saved account widget
instance placement. Media fill objects remain in instance state. Uploaded files
are account assets resolved before generation.

## Verification

```bash
pnpm validate:widgets
```
