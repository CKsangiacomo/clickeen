# Dieter - The Clickeen Design System

**Living, canonical reference - the system overview.**

- Canonical doctrine: this document.
- Execution PRD: [`126H__PRD__Dieter.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126H__PRD__Dieter.md).
- **Source of truth:** `dieter/tokens/*`, `dieter/layouts/*`,
  `dieter/components/*`, `dieter/icons/icons.json`, and
  `dieter/icons/svg/*`. Consumers compile or materialize this source directly.
  Only the SVG icon bytes are deployed as shared CDN files. The code is
  authoritative; this doc explains it.
- Sibling references: [`color.md`](color.md), [`typography.md`](typography.md), [`motion.md`](motion.md), [`iconography.md`](iconography.md), [`components.md`](components.md).

## What Dieter is

Dieter is Clickeen's token-first design system.
The whole UI composes upward by **reference**, never by copy:

```text
tokens  ->  layouts + components  ->  screens
```

A change at an inner doll rolls outward to everything that consumes it, for free.
That property — not any single token or component — is the system's core value,
and it is why "by reference, not copy" is the load-bearing rule of the whole 126
program.

## The dolls

**Tokens (innermost).** Raw values that everything else points at. Four files:
- `dieter-color-tokens.css` — color (see [`color.md`](color.md)).
- `dieter-foundation-tokens.css` — the foundation substrate (below).
- `dieter-typography.css` — type (see [`typography.md`](typography.md)).
- `tokens.css` — `@import`s the three above.

**Layouts and components (middle).** `dieter/layouts/main-container/*` owns the
shared application Layout/Page structure. The 28 non-empty source directories
under `dieter/components/*` comprise 27 component directories plus the
non-rendered `shared/` helper directory. Component source shape varies by
contract; see [`components.md`](components.md) for the exact catalog and
hydration/spec model.

**Screens (outermost).** DevStudio, Roma, Bob — each consumes Dieter at a
different depth. See [`surfaces.md`](surfaces.md).

## Foundation substrate (non-color, non-type)

Everything that isn't color or type lives in `dieter-foundation-tokens.css`.
Each scale below is a current Dieter substrate decision. Color, typography,
icon use, motion, interaction state, component behavior, and dialog/modal
layering are owned by their own UI docs.

- **Structural spacing** - `--space-0` through `--space-10`. Use this for
  layout spacing, page/component gaps, padding, and structural rhythm.
- **Application layout** - `--layout-left-nav-width`,
  `--layout-left-nav-padding`, `--layout-page-padding`, and
  `--layout-compact-left-nav-width` are the editable values used by the
  `main-container` layout.
- **Vertical rhythm** - `--vertspace-1` through `--vertspace-9`. Use this for
  compact vertical breathing room inside dense controls where structural
  spacing is too coarse.
- **Control sizing** - `--control-size-xs` through `--control-size-xl` define
  visual control heights. They are not mobile/touch target doctrine.
- **Control geometry** - `--control-padding-inline`,
  `--control-inline-gap-xs` through `--control-inline-gap-xl`, and
  `--control-radius-none` through `--control-radius-10xl`.
- **Icon sizing** - `--icon-size-12` through `--icon-size-40`. Icon origination,
  render, sizing consumption, color, and semantics are in
  [`iconography.md`](iconography.md).
- **Elevation** - `--shadow-elevated`, `--shadow-floating`, and
  `--shadow-inset-control`. `--shadow-elevated` has real Roma and Prague
  consumers, so any change must include them in its blast radius. Do not expand
  these three roles into a larger elevation scale here.
- **Semantic utility** - `.sr-only` exposes text for assistive technology when
  visible layout should not show it. [`accessibility.md`](accessibility.md) owns
  semantic truth.
- **Motion bridge** - `--duration-snap`, `--duration-base`, and
  `--easing-standard` are documented in [`motion.md`](motion.md).
- **Reduced-motion guard** - the global
  `@media (prefers-reduced-motion: reduce)` block ships in foundation source.

## How the component system works

- **Stencil + spec where the component is field-rendered.** Rendered editor
  components normally pair an `.html` stencil with a `.spec.json` binding
  model. CSS-only primitives and specialized components may intentionally have
  a smaller source shape; the exact exceptions and deletion targets are listed
  in [`components.md`](components.md).
- **Hydration.** Interactive components export source `hydrate*` functions.
  Bob imports the hydrators it uses and calls them explicitly. CSS/HTML-only
  components need no browser runtime.
- **Consumption.** Bob and Roma compile `dieter/styles.css`; Prague compiles
  token source; widget materialization folds required Dieter CSS into instance
  `styles.css`. Roma and DevStudio also import the shared application layout
  directly; Bob retains its ToolDrawer/Workspace layout. Only
  `dieter/icons/svg/**` is deployed to Tokyo R2. See [`ops.md`](ops.md).

## Package And Artifact Boundary

Dieter has no generated runtime mirror or browser manifest. App builds consume
source, and public widget packages contain the CSS they require. The CDN is
used only for approved SVG icon bytes.

For account-font controls, Dieter owns dropdown presentation and emits the
selected family as raw control intent. It may filter visible weight/style
options from supplied metadata, but it does not choose companion values or emit
a three-field typography operation. Bob and Roma resolve the family transition
through the shared account-font product law.

`@ck/dieter` is a source/typecheck task package, not a separately shipped
runtime. Consumers use the source entrypoints named above. Do not invent a
second package, registry, generated bundle, or browser entrypoint.

## Current Boundaries

- `tokens.css` is the composed entrypoint. Foundation shadows reference color
  tokens, so the foundation file is consumed through that composition.
- Numeric radius aliases are not Dieter law. Use `--control-radius-*`.
- Focus-ring width, focus-ring offset, and touch-target sizing are not Dieter
  foundation doctrine. Shared widget focus width is the explicit literal
  `2px`; `--focus-ring-color` is a color token owned by
  [`color.md`](color.md).
- `--shadow-lg` is not a Dieter token. DevStudio consumes
  `--shadow-elevated` directly and does not preserve the old dead alias.
- There is no z-index token family in Dieter. Component layering belongs to
  [`components.md`](components.md) and dialog/modal behavior belongs to
  [`dialogs-and-modals.md`](dialogs-and-modals.md).
- Current Dieter color law is light-mode only; there is no current dark-mode
  contract. See [`color.md`](color.md).
- Component-specific raw shadows, raw z-index values, and component API cleanup
  belong to [`components.md`](components.md) unless a more specific living
  doctrine owns the surface.
