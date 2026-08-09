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
logoshowcase_tooldrawer_l10n_labels/
  en.json
widget.html
widget.css
widget.client.js
```

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `logoshowcase` |
| display name | Logo Showcase |
| Core namespace | `logoshowcase.*` |
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
items.group.small.max -> logoshowcase.strips[]
items.group.medium.max -> logoshowcase.strips[].logos[]
items.group.large.max -> logoshowcase.strips[].logos[]
```

## Shared Widget Utilities

Logo Showcase uses the presentation frame for Stage/Pod, the Shell for
Header/Core composition, and shared utilities for Core sizing, typography,
branding, social share, and locale switching. Logo strips and logo items belong
to `logoshowcase.*`.

Runtime requires these Core DOM hooks:

```text
[data-role="logoshowcase"]
[data-role="logoshowcase-core"]
```

`widget.client.js` registers as `logoshowcase`, validates `logoshowcase.*`,
renders strips/logos into `logoshowcase-core`, applies shared widget utilities,
and binds `ck:state-update` for the current instance id.

Runtime invariants:

- `logoshowcase.type` is `grid` or `carousel`.
- Carousel mode is `paged` or `continuous`.
- Carousel state owns step, arrows, swipe, autoplay delay, transition, speed,
  direction, and pause-on-hover behavior.
- `logoshowcase.strips[]` ids must be stable and unique.
- `logoshowcase.strips[].logos[]` ids must be stable and unique inside each
  strip.
- Logo state includes logo fill, `href`, `targetBlank`, `nofollow`, `alt`,
  `title`, `caption`, and `name`.
- Logo media must use resolved account asset media or a valid relative,
  absolute-path, or `http(s)` URL accepted by runtime validation.
- Logo media rejects malformed URLs, `javascript:` URLs, and product-local
  `/widgets/logoshowcase/media/` references.
- Logo links are normalized as `http(s)` URLs.
- Card wrapper styling uses shared `CKSurface.applyCardWrapper`.
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
