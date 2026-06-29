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
  composition, component-system mechanics. *(126H)*

**Disciplines (tokens)**
- [`accessibility.md`](accessibility.md) — semantic product truth: names, roles,
  visible state, status, and error honesty *(126A)*
- [`color.md`](color.md) — light-mode color roles, tokens, state color mechanics,
  DevStudio reveal truth, and human-owned contrast decisions *(126B)*
- [`iconography.md`](iconography.md) — Dieter icon consumption, rendering,
  sizing, color, and semantics *(126C)*
- [`typography.md`](typography.md) — Google fonts, account-uploaded fonts,
  typography tokens, and text rendering rules *(126D)*
- [`interactions.md`](interactions.md) — states, command flows, feedback, save,
  Agent Activity, upsell, and bulk progress patterns *(126E)*
- [`motion.md`](motion.md) — small system motion law, duration/easing tokens,
  and reduced-motion behavior for Dieter/system UI *(126F)*
- [`ops.md`](ops.md) — current UI build/serve/govern runbook *(126G)*

**Components**
- [`components.md`](components.md) — the library reference: per-component usage specs *(126I)*
- [`dialogs-and-modals.md`](dialogs-and-modals.md) — dialog/modal mechanics and
  overlay behavior boundaries *(126K)*

**Consumption**
- [`surfaces.md`](surfaces.md) — surface containers and planes used by layouts *(126J)*

## Conventions

- Every doc states its **source of truth** (the CSS/code) up front; the code wins.
- Every doc records **honest gaps** rather than claiming conformance it hasn't
  measured — these are the 126 series' work items.
- Cross-doc seams are called out inline (e.g. typography↔color, components↔dieter,
  dialogs↔accessibility) so nothing is duplicated and nothing falls through.
