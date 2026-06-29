# Dieter — the Clickeen design system

**Living, canonical reference — the system overview.**
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

**Components (middle).** ~27 components under `dieter/components/*`, each
`.css` + `.html` stencil + `.spec.json` + (usually) a `.ts` hydrate function.
See [`components.md`](components.md) for the catalog and the hydration/spec model.

**Screens (outermost).** DevStudio, Roma, Bob — each consumes Dieter at a
different depth. See [`surfaces.md`](surfaces.md).

## Foundation substrate (non-color, non-type)

Everything that isn't color or type lives in `dieter-foundation-tokens.css`.
Each scale below is a candidate for its own discipline doc where it merits one;
the rest stay here as substrate.

- **Spacing** — `--space-0`…`--space-10` (2px→40px, 4px grid). The base length.
- **Vertical rhythm** — `--vertspace-1`…`--vertspace-9` (0→0.8rem, 0.1rem steps).
  Genuinely separate from `--space-*` (sub-2px rhythm, not aliases).
- **Control sizing** — `--control-size-xs`…`--control-size-xl` (16→32px heights).
- **Control geometry** — `--control-padding-inline` + `--control-inline-gap-xs…xl`
  (internal gaps) + `--control-radius-none…10xl` (14-stop radius scale, 0→76px),
  plus `--radius-3`/`--radius-4` surface aliases.
- **Icon sizing** — `--icon-size-12`…`--icon-size-40` (8 stops).
- **Elevation** — `--shadow-elevated` / `--shadow-floating` / `--shadow-inset-control`
  (all `color-mix(in oklab, …)`, so elevation not color).
- **Semantic utility** — `.sr-only` exposes text for assistive technology when
  visible layout should not show it; 126A owns semantic truth, not focus or touch
  target programs.
- **Motion** — `--duration-snap/base/spin` — see [`motion.md`](motion.md).
- **Utilities** — `.sr-only` (line 92) and `@media (prefers-reduced-motion: reduce)`
  (line 99) ship here.

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

## Honest gaps (improved during the 126 series)

- No z-index token system — raw `z-index` literals across component CSS.
- No easing-curve token — only durations (see [`motion.md`](motion.md)).
- Color: current Dieter color law is light-mode only; there is no current
  dark-mode contract (see [`color.md`](color.md)).
- `command-activity` is a dead/empty dir; `textrename` missing `.spec.json`.
