# Clickeen UI - Engineering Docs

Permanent, living home for Clickeen's UI product and design-system law. The
parent program owns execution order and the reason this documentation home
exists:
[`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/03-Executed/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).

Each domain doc links to its owning 126 PRD. Runtime source says what the product
does now; living doctrine says the accepted standard. A mismatch between them
is a Step 6 gap, not permission to reinterpret either authority.

## The model

The UI composes by reference:

```text
tokens -> layouts + components -> screens
```

Every doc points inward at its owning source and outward to the consumers in
its blast radius. Product law lives in the domain doctrine; current runtime
behavior lives in source.

## Governing component law

These rules govern every Dieter component and every UI surface that consumes
one:

- A Dieter component is a consumer-agnostic primitive. It owns reusable
  structure, presentation, and component-generic interaction—not Widget,
  account, Bob, Roma, policy, or another consumer's product meaning.
- Consumer-specific data, capability rules, state transitions, and composition
  remain in the owning consumer. They do not create Dieter branches or ad hoc
  component variants.
- Human-language copy is caller input. The caller resolves the exact string;
  Dieter does not load locales, choose translations, or keep a component copy
  catalog.
- ToolDrawer copy uses one shape: `$label:{key}` in the Widget spec, the exact
  value in that Widget's adjacent label file, compiler resolution into the
  Widget editor artifact, and the resolved string passed to the Dieter
  primitive.
- Bob and Roma Chrome use the same component boundary: their owning UI
  localization source resolves the string before the component receives it.
  A component never gets a Bob-, Roma-, or Widget-specific localization API.
- Shared presentation is fixed in the existing Dieter primitive or shared
  Dieter source. Different product jobs remain separate consumer composition;
  visual consistency is not permission to merge their behavior.
- The account upsell Popup is one multi-owner composition, not a component that
  owns all of its copy. A Widget-bound denial contributes its exact localized
  contextual body through the compiled Widget contract; system policy
  contributes current/target plan truth; Roma contributes the system CTA and
  hosts the Popup; Dieter contributes mechanics only. No layer substitutes a
  missing Widget message or duplicates the Popup in Bob.

[`components.md`](components.md) owns exact component APIs and
[`dieter.md`](dieter.md) owns the system mechanics. A source violation is a
component defect to correct in its owning pass, not a precedent for another
exception.

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
  Agent Activity, the composed pre-GA upsell Popup, and bulk progress patterns *(126E)*
- [`motion.md`](motion.md) — small system motion law, duration/easing tokens,
  and reduced-motion behavior for Dieter/system UI *(126F)*
- [`ops.md`](ops.md) — current UI build/serve/govern runbook *(126G)*

**Components**
- [`components.md`](components.md) — the library reference: per-component usage specs *(126I)*
- [`dialogs-and-modals.md`](dialogs-and-modals.md) — dialog/modal mechanics,
  exact dismissal policy, and upsell transition behavior *(126K)*

**Consumption**
- [`surfaces.md`](surfaces.md) — the shared Layout/Page contract, surface
  containers, and the global workspace-capability tenet for operational
  applications *(126J)*

## Conventions

- Every doc states its product-law authority and current source authority up
  front. Differences are recorded as execution gaps.
- Every doc records **honest gaps** rather than claiming conformance it hasn't
  measured — these are the 126 series' work items.
- Cross-doc seams are called out inline (e.g. typography↔color, components↔dieter,
  dialogs↔accessibility) so nothing is duplicated and nothing falls through.
