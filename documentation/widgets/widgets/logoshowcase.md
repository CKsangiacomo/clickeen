# Logo Showcase Widget

STATUS: CANONICAL CORE DEPLOYED TO CLOUD-DEV — OWNER QA PENDING

## Purpose

Logo Showcase renders one or more stable logo collections as a grid, paged
carousel, or continuous carousel inside the shared Widget Shell.

## Architecture Status

Logo Showcase uses the canonical Widget contract in cloud-dev. `widget.html`
composes shared Stage, Pod, Header, and shared capabilities with one Logo
Showcase Core. `core/core.html` owns complete semantic strip/logo content,
`core/core.css` owns its presentation, and `core/core.js` owns only
deterministic order and carousel visitor behavior.

Bob preview and explicit allowed Publish use the same compiled Widget
software. The materializer writes every saved strip and logo in its current
order before JavaScript runs. Core JavaScript does not reconstruct saved state,
localize content, invoke shared utilities, or receive Bob state updates. There
is no flat-source compatibility path or Widget-specific shared-service branch.

The source, generated artifacts, and cloud-dev deploy proof are complete.
Owner QA and a fresh Logo Showcase Publish/Republish exercise remain pending.

## Source

```text
tokyo/product/widgets/logoshowcase/
```

Files:

```text
spec.json
editable-fields.json
discovery.json
limits.json
labels/
  en.json
upsell/
  en.json
widget.html
core/
  core.html
  core.css
  core.js
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

Core state families:

```text
logoshowcase.appearance
logoshowcase.behavior
logoshowcase.spacing
logoshowcase.strips
logoshowcase.type
logoshowcase.typeConfig
```

Operator control map:

```text
logoshowcase.type -> grid|carousel
logoshowcase.typeConfig.carousel.mode -> paged|continuous
logoshowcase.spacing -> logo height and gaps
logoshowcase.appearance -> logo look, opacity, item background, cardwrapper
logoshowcase.behavior.randomOrder -> deterministic shuffle
```

`spec.json` declares stable strip/logo identity coordinates through the
currently named `normalization.idRules` compiler field. This is structural
source metadata for the authoring boundary; it does not authorize downstream
repair or revalidation of accepted Widget state.

## Editable Fields And Stable Items

```text
header.title
header.subtitleHtml
headerCta.label
logoshowcase.strips[].logos[].name
logoshowcase.strips[].logos[].caption
logoshowcase.strips[].logos[].alt
logoshowcase.strips[].logos[].title
```

Every strip and logo carries a stable `id`. Together those ids anchor exact
localization and discovery identity across reorder, insert, and delete. The
generic source renderer separately supplies a render-only positional path for
authored repeated-item CSS. Stable content identity and positional style paths
are different coordinates.

Image alt text and logo tooltip text are exact authored attribute slots. Logo
name and alt text are also materialized as semantic accessible text so a
localized overlay updates the visible/assistive meaning rather than relying on
visitor JavaScript.

## ToolDrawer Composition

Logo Showcase follows canonical panel order and keeps only shared Header and
the primary Content section open initially.

- Content owns shared Header content plus exact strip/logo collections. Object
  Manager owns strips, each strip owns one Repeater of logos, each logo owns
  its image Fill, and Bulk Edit owns name, caption, link, target, nofollow, alt,
  and tooltip values.
- Layout owns shared Header geometry, shared Core size, Grid versus Carousel,
  logo height/gaps, current Carousel controls, and shared Stage/Pod geometry.
- Appearance owns shared Header appearance, logo treatment/opacity, logo-tile
  surface, and shared Stage/Pod appearance.
- Typography uses the shared Widget typography contract.
- Settings owns deterministic logo shuffling followed by shared SEO/GEO,
  branding, and social-share behavior.

Widget-owned ToolDrawer words come from `labels/en.json`. The source owns
paths, options, component inputs, and visibility rules; Bob compiles them
without inventing Logo Showcase semantics.

## Discovery

`discovery.json` identifies Logo Showcase as a `logo-showcase`. For each stable
logo it declares name, caption, image alt text, and tooltip as important
customer-content parts, and declares that the caption describes the name.

This file is internal Widget software; users do not edit it. Free and Tier 1
use its system baseline, including Clickeen identification. When a Tier 2+
account enables SEO/GEO, Publish may optimize technical discovery output from
the exact saved logo content. Only Publish materialization writes public
files.

## Limits

```text
branding.remove -> behavior.showBacklink -> branding.remove
widget.socialShare.enabled -> behavior.socialShare.enabled -> social-share.enable
embed.seoGeo.enabled -> behavior.seoGeo.enabled -> seo-geo.enable
items.group.small.max -> logoshowcase.strips[] -> strips.max
items.group.medium.max -> logoshowcase.strips[].logos[] -> logos-per-strip.max
items.group.large.max -> logoshowcase.strips[].logos[] -> logos-total.max
```

The final value on each line is the exact message identity in
`upsell/en.json`. The three item messages separately explain adding strips,
adding logos to one strip, and exceeding the Widget-wide logo count. Account
policy supplies the decision and current/target plans; Roma supplies the
system CTA and Popup. Core and public runtime consume none of this product UI
contract.

## Materialized Core And Visitor Behavior

Core HTML contains all strips as semantic sections and all logos as semantic
lists. Each logo keeps its saved id, media, name, caption, alt text, tooltip,
link, target, and nofollow state. Exact accepted asset/link values are
materialized unchanged; downstream Core behavior does not normalize or
revalidate them. Core CSS owns responsive grid/tile geometry, logo treatment,
item surfaces, caption presentation, and carousel geometry.

Core JavaScript performs only behavior that requires a live visitor document:

- optional random order is deterministic from the exact strip/logo ids;
- Paged Carousel binds current arrows, swipe/scroll geometry, transition, and
  optional autoplay;
- Continuous Carousel clones the already-localized materialized list for
  motion, hides the clone from accessibility, removes its links from keyboard
  traversal, and measures the rendered seam gap.

The Core keeps asynchronous behavior scoped to the current rendered preview
body. On the next initialization it cancels any prior pager animation frame,
autoplay interval, and ResizeObservers before binding the replacement body.
Removed-root event listeners require no separate lifecycle machinery.

Current behavior boundaries preserved by the migration:

- a final partial Paged Carousel page follows the existing page-index/step
  calculation;
- continuous speed keeps its existing editor contract;
- Paged arrow accessible names remain the Core-authored English `Previous` and
  `Next`;
- caption reveal remains hover/focus based;
- the shared Header and shared Object Manager keep their existing system
  behavior rather than gaining Logo-Showcase-specific substitutes.

Shared Header, Stage, Pod, branding, social share, and locale switching remain
generic shared services. Core neither invokes nor revalidates them.

## Verification

```bash
pnpm validate:widgets
pnpm --filter @clickeen/widget-foundation typecheck
pnpm --filter @clickeen/bob test:editor-contract
node --check tokyo/product/widgets/logoshowcase/core/core.js
```
