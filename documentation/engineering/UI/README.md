# Clickeen UI — engineering docs

Permanent, living home for clickeen's UI design-system truth. Seeded 2026-06-27
from the as-built code; each doc is improved in place as UI program **126**
executes. Authority and the "why this home exists" rationale:
[`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).

## The model

The UI is a matrioska (Brad-Frost atomic) system: **tokens → components → screens**,
each layer composing by reference. Every doc here points inward at its
authoritative CSS/code; the code is truth, the docs explain it. Docs are seeded
once, then improved during the matching 126 track — never duplicated across PRDs.

## The docs

**System**
- [`dieter.md`](dieter.md) — the design system: matrioska law, foundation substrate,
  composition, component-system mechanics. *(track 126A)*

**Disciplines (tokens)**
- [`color.md`](color.md) — Apple system colors + OKLAB derivation engine *(126A)*
- [`typography.md`](typography.md) — families, size scale, fluid display, line-height,
  utility classes *(126A)*
- [`motion.md`](motion.md) — durations, reduced-motion (+ easing gap) *(126A)*
- [`iconography.md`](iconography.md) — the 157-icon SF-Symbols-style set + pipeline *(126B)*
- [`accessibility.md`](accessibility.md) — the cross-cutting a11y contract *(all tracks)*

**Components**
- [`components.md`](components.md) — the library reference: per-component usage specs *(126B)*
- [`dialogs-and-modals.md`](dialogs-and-modals.md) — the overlay system (modal/popover rules) *(126B/126D)*

**Behavior & operations**
- [`interactions.md`](interactions.md) — states, command flows, feedback *(126C/126D)*
- [`ops.md`](ops.md) — build / serve / govern / freeze runbook *(126C)*

**Consumption**
- [`surfaces.md`](surfaces.md) — how Bob (bar), DevStudio (reveal), Roma (converge) consume Dieter *(126C/126D)*

## Conventions

- Every doc states its **source of truth** (the CSS/code) up front; the code wins.
- Every doc records **honest gaps** rather than claiming conformance it hasn't
  measured — these are the 126 series' work items.
- Cross-doc seams are called out inline (e.g. typography↔color, components↔dieter,
  dialogs↔accessibility) so nothing is duplicated and nothing falls through.
