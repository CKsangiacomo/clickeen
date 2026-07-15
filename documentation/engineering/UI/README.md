# Clickeen UI - Engineering Docs

Permanent, living home for Clickeen's UI product and design-system law. The
parent program owns execution order and the reason this documentation home
exists:
[`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).

Each domain doc links to its owning 126 PRD. Runtime source says what the product
does now; living doctrine says the accepted standard. A mismatch between them
is a Step 6 gap, not permission to reinterpret either authority.

## The model

The UI composes by reference: **tokens -> components -> screens**. Every doc
points inward at its owning source and outward to the consumers in its blast
radius. Product law lives in the domain doctrine; current runtime behavior lives
in source.

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
  Agent Activity, the pre-GA upsell scaffold, and bulk progress patterns *(126E)*
- [`motion.md`](motion.md) — small system motion law, duration/easing tokens,
  and reduced-motion behavior for Dieter/system UI *(126F)*
- [`ops.md`](ops.md) — current UI build/serve/govern runbook *(126G)*

**Components**
- [`components.md`](components.md) — the library reference: per-component usage specs *(126I)*
- [`dialogs-and-modals.md`](dialogs-and-modals.md) — dialog/modal mechanics,
  exact dismissal policy, and upsell transition behavior *(126K)*

**Consumption**
- [`surfaces.md`](surfaces.md) — surface containers, layout planes, and the
  global workspace-capability tenet for operational applications *(126J)*

## Conventions

- Every doc states its product-law authority and current source authority up
  front. Differences are recorded as execution gaps.
- Every doc records **honest gaps** rather than claiming conformance it hasn't
  measured — these are the 126 series' work items.
- Cross-doc seams are called out inline (e.g. typography↔color, components↔dieter,
  dialogs↔accessibility) so nothing is duplicated and nothing falls through.
