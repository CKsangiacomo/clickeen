# Dieter - The Clickeen Design System

**Living, canonical reference - the system overview.**
Seeded 2026-06-27 from the as-built tokens/code; improved in place as UI program 126 executes.

- Authority (why this home exists): [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Source of truth:** `dieter/tokens/*`, `dieter/components/*`,
  `dieter/icons/icons.json`, and `dieter/icons/svg/*`. Root
  `scripts/build-dieter.js` propagates Dieter output. The code is authoritative;
  this doc explains it.
- Sibling references: [`color.md`](color.md), [`typography.md`](typography.md), [`motion.md`](motion.md), [`iconography.md`](iconography.md), [`components.md`](components.md).

## What Dieter is

Dieter is clickeen's design system — token-first and atomic (Brad-Frost / matrioska).
The whole UI composes upward by **reference**, never by copy:

```text
tokens  ->  components  ->  screens
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

**Components (middle).** 26 components under `dieter/components/*`, each
`.css` + `.html` stencil + `.spec.json` + (usually) a `.ts` hydrate function.
See [`components.md`](components.md) for the catalog and the hydration/spec model.

**Screens (outermost).** DevStudio, Roma, Bob — each consumes Dieter at a
different depth. See [`surfaces.md`](surfaces.md).

## Foundation substrate (non-color, non-type)

Everything that isn't color or type lives in `dieter-foundation-tokens.css`.
Each scale below is a current Dieter substrate decision. Color, typography,
icon use, motion, interaction state, component behavior, and dialog/modal
layering are owned by their own UI docs.

- **Structural spacing** - `--space-0` through `--space-10`. Use this for
  layout spacing, page/component gaps, padding, and structural rhythm.
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
  `--shadow-inset-control`. Do not expand these into an elevation scale here.
- **Semantic utility** - `.sr-only` exposes text for assistive technology when
  visible layout should not show it. 126A owns semantic truth.
- **Motion bridge** - `--duration-snap`, `--duration-base`, and
  `--easing-standard` are documented in [`motion.md`](motion.md).
- **Reduced-motion guard** - the global
  `@media (prefers-reduced-motion: reduce)` block ships in foundation source.

## How the component system works

- **Stencil + spec.** Each component has an `.html` stencil with `{{mustache}}`
  slots and a `.spec.json` that declares the binding model (e.g. `string`,
  `no-binding`, `row-path`) and the `tooldrawer-field` type for editor fields.
- **Hydration.** Most components export a `hydrate*` function re-exported from
  `dieter/components/index.ts`. Exceptions: `icon`, `slider`, `popover`,
  `agent-activity` are CSS/HTML only; `object-manager` and `repeater` ship
  hand-written `.js` IIFEs (not in `index.ts`). See [`components.md`](components.md).
- **Build.** Root `scripts/build-dieter.js` bundles tokens + components + icons
  into `tokyo/product/dieter/**`, served from Tokyo R2 at `/dieter`. See
  [`ops.md`](ops.md).

## Current Boundaries

- `tokens.css` is the composed entrypoint. Foundation shadows reference color
  tokens, so the foundation file is consumed through that composition.
- Numeric radius aliases are not Dieter law. Use `--control-radius-*`.
- Focus-ring width, focus-ring offset, and touch-target sizing are not Dieter
  foundation doctrine. `--focus-ring-color` is a color token owned by
  [`color.md`](color.md).
- There is no z-index token family in Dieter. Component layering belongs to
  [`components.md`](components.md) and dialog/modal behavior belongs to
  [`dialogs-and-modals.md`](dialogs-and-modals.md).
- Current Dieter color law is light-mode only; there is no current dark-mode
  contract. See [`color.md`](color.md).
- Component-specific raw shadows, raw z-index values, and component API cleanup
  belong to [`components.md`](components.md) unless a more specific PRD owns the
  surface.
