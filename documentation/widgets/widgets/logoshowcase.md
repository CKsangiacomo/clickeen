# Logo Showcase Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Logo Showcase renders logo strips for grid or motion presentation inside the
shared widget Shell.

## Source

```text
tokyo/product/widgets/logoshowcase/
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
| `widgetname` | `logoshowcase` |
| display name | Logo Showcase |
| Core namespace | `logoshowcase.*` |
| `itemKey` | `logoshowcase.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

Core defaults live under:

```text
logoshowcase
uiLabels
```

`spec.json` includes widget-local normalization for Logo Showcase Core state.

Core state families:

```text
logoshowcase.appearance
logoshowcase.behavior
logoshowcase.spacing
logoshowcase.strips
logoshowcase.type
logoshowcase.typeConfig
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
logoshowcase.strips[].logos[].name
logoshowcase.strips[].logos[].caption
logoshowcase.strips[].logos[].alt
logoshowcase.strips[].logos[].title
```

`logoshowcase.strips[]` and `logoshowcase.strips[].logos[]` entries carry
stable `id` values in widget Core state.

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
items.group.small.max -> logoshowcase.strips[]
items.group.medium.max -> logoshowcase.strips[].logos[]
items.group.large.max -> logoshowcase.strips[].logos[]
```

## Shell Utilities

Logo Showcase uses the shared Shell for Header, Header CTA, Stage/Pod, Core
size, typography, branding, social share, and locale switcher. Logo strips and
logo items belong to `logoshowcase.*`.

Generated `index.html` contains the complete strips and logos. Its stable Core
hooks include:

```text
[data-role="logoshowcase"]
[data-role="logoshowcase-core"]
```

`runtime.js` registers as `logoshowcase` through `CKWidgetRuntime` and binds the
deterministic ordering and carousel behavior to generated logo DOM. Continuous
carousel behavior may clone an existing generated ticker; it does not render
the primary strip/logo content from config or accept generic state updates.

Runtime invariants:

- `logoshowcase.type` is `grid` or `carousel`.
- Carousel mode is `paged` or `continuous`.
- Carousel state owns step, arrows, swipe, autoplay delay, transition, speed,
  direction, and pause-on-hover behavior.
- Logo state includes logo fill, `href`, `targetBlank`, `nofollow`, `alt`,
  `title`, `caption`, and `name`.
- Card wrapper styling is generated from the shared Shell surface contract.
- Keyboard focus uses Dieter's shared `--focus-ring-color`.
- `logoshowcase.behavior.randomOrder` is deterministic from strip/logo ids; it
  is not nondeterministic shuffle.

Operator control map:

```text
logoshowcase.type -> grid|carousel
logoshowcase.typeConfig.carousel.mode -> paged|continuous
logoshowcase.spacing -> logo size and gaps
logoshowcase.appearance -> logo look, opacity, item background, cardwrapper
logoshowcase.behavior -> random order and carousel behavior
```

## Verification

```bash
pnpm validate:widgets
```
