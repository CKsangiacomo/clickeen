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
index.html
styles.css
runtime.js
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
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
```

## Shell Utilities

Split Media uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher. The media surface
belongs to `splitMedia.*`.

Generated `index.html` contains the complete media surface. Its stable Core
hooks are:

```text
[data-role="split-media"]
[data-role="split-media-core"]
```

`runtime.js` has no Widget-local interaction. Web Code Generator renders the
structured `splitMedia.*` values into the complete media surface in
`index.html`.

Core state includes:

- `splitMedia.media.type` (`none`, `image`, or `video`).
- Video media may include a poster and defaults muted, loop, autoplay, and
  playsinline behavior unless explicitly disabled by state.
- `splitMedia.alt` is the customer-visible alt/aria text path.
- `splitMedia.fit` and `splitMedia.position` control rendered media fit and
  position.
- `splitMedia.appearance.cardwrapper` controls the generated visual frame
  through the shared Shell surface contract.
- Auto core size uses a 16:9 shape with a 320px minimum height in current CSS.

## Clickeen Pages Usage

Split Media appears in Clickeen Page source as a saved account widget instance
placement. The media fill object, alt text, fit, position, and visual frame
config remain account-owned instance state.

## Verification

```bash
pnpm validate:widgets
```
