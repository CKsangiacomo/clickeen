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
| panels | `content`, `layout`, `appearance`, `typography`, `settings` |

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

## ToolDrawer Composition

Logo Showcase follows the canonical panel order and keeps only shared Header
and the primary Content section open initially.

- Content owns shared Header content plus the exact strip/logo collections.
  Object Manager owns strips, each strip owns one Repeater of logos, each logo
  owns its image Fill, and Bulk Edit owns the existing name, caption, link,
  target, nofollow, alt, and tooltip columns.
- Layout owns shared Header geometry, shared Core size, Grid versus Carousel,
  logo height and gaps, the existing Carousel controls, and shared Stage/Pod
  geometry. Pause on hover is shown for Continuous Carousel or for Paged
  Carousel only when Autoplay is enabled.
- Appearance owns shared Header appearance first, followed by logo treatment,
  logo opacity, logo-tile surface, and shared Stage/Pod appearance.
- Typography uses the shared Widget typography contract.
- Settings owns deterministic logo shuffling followed by shared behavior.

All Widget-owned ToolDrawer words come from the adjacent English label file.
The Widget source owns paths, options, component inputs, and visibility rules;
Bob compiles them without inventing Logo Showcase semantics.

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
- Logo-grid, strip-gap, tile-size, and Carousel-gap presentation respond to the
  available Pod inline size through the existing Pod container, not the browser
  viewport. Paged movement reads that rendered gap, so motion and presentation
  share one geometry truth.
- Continuous Carousel preserves the configured gap both inside a ticker copy
  and across the seam between its two copies. Its animation distance includes
  that seam gap.
- The static package contains no invented Header title, CTA label, or CTA URL.
  Shared Header runtime reveals exact saved/localized Header state.

Operator control map:

```text
logoshowcase.type -> grid|carousel
logoshowcase.typeConfig.carousel.mode -> paged|continuous
logoshowcase.spacing -> logo height and gaps
logoshowcase.appearance -> logo look, opacity, item background, cardwrapper
logoshowcase.behavior.randomOrder -> deterministic shuffle
```

## Frozen Current Behavior

The Widget-system presentation pass does not alter product functionality,
state, defaults, validation, limits, save behavior, or shared component law.
The following reachable concerns therefore remain explicit for later product
decisions:

- a final partial Paged Carousel page can remain unreachable in the current
  page-index calculation;
- a malformed nonempty logo `href` currently becomes a non-link instead of an
  explicit validation failure;
- Continuous Carousel duplicates its interactive logo copy without suppressing
  the second copy from accessibility traversal;
- Continuous speed is runtime-positive but has no exact positive editor bound;
- Paged arrow accessible names are runtime-owned English `Previous` and `Next`;
- caption reveal depends on hover or focus, so a non-linked logo has no reliable
  touch reveal;
- the shared Header still changes left/right composition by viewport rather
  than Pod size, so a left/right Header can consume a very narrow Pod on a wide
  page; that correction belongs to the shared Header owner;
- Object Manager's relative `logos.0.name` display label is currently emitted
  by Bob as a phantom global compiled control and can reach Product Copilot.
  The systemic correction belongs to Bob's derived-control compiler, not to
  Logo Showcase state.

These are not repaired, hidden behind Widget-local substitutes, or described as
complete by this pass.

## Verification

```bash
pnpm validate:widgets
pnpm --filter @clickeen/bob test:editor-contract
```
