# Split Media Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Split Media renders a split section with one media surface inside the shared
widget Shell.

## Source

```text
tokyo/product/widgets/split-media/
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
| `widgetname` | `split-media` |
| display name | Split Media |
| Core namespace | `splitMedia.*` |
| `itemKey` | `split-media.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

Core defaults live under:

```text
splitMedia
uiLabels
```

Core state families:

```text
splitMedia.alt
splitMedia.appearance
splitMedia.fit
splitMedia.media
splitMedia.position
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
splitMedia.alt
```

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
```

## Shell Utilities

Split Media uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher. The media surface
belongs to `splitMedia.*`.

Runtime requires these Core DOM hooks:

```text
[data-role="split-media"]
[data-role="split-media-core"]
```

`widget.client.js` registers as `split-media`, validates `splitMedia.*`, renders
the media surface into `split-media-core`, applies shared Shell utilities, and
binds `ck:state-update` for the current instance id.

Runtime invariants:

- `splitMedia.media.type` is `none`, `image`, or `video`.
- Empty media state must not include populated image/video buckets.
- Image/video media source values must be non-empty and accepted as relative,
  absolute-path, or `http(s)` URLs.
- Video media may include a poster and defaults muted, loop, autoplay, and
  playsinline behavior unless explicitly disabled by state.
- `splitMedia.alt` is the customer-visible alt/aria text path.
- `splitMedia.fit` and `splitMedia.position` control rendered media fit and
  position.
- `splitMedia.appearance.cardwrapper` controls the visual frame through shared
  `CKSurface.applyCardWrapper`.
- Auto core size uses a 16:9 shape with a 320px minimum height in current CSS.

## Clickeen Pages Usage

Split Media appears in Clickeen Page source as a saved account widget instance
placement. The media fill object, alt text, fit, position, and visual frame
config remain account-owned instance state. Public page package serving depends
on Roma writing real page packages.

## Verification

```bash
pnpm validate:widgets
```
