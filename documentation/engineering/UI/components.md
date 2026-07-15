# Dieter components — the library reference

**Living, canonical reference — how to use each component.**

- Canonical doctrine: this document.
- Execution PRD: [`126I__PRD__Components.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126I__PRD__Components.md).
- **Source of truth:** `dieter/components/*` (the `.css`, `.html`, `.spec.json`,
  `.ts`, or `.js` files present for each declared contract) and
  `dieter/components/index.ts`.
- System mechanics (hydration model, spec binding, build): see [`dieter.md`](dieter.md). This doc is the per-component lookup; that doc explains the system once.

## Catalog (25 source directories including `shared`)

Legend: ✅ exported from `index.ts` · ⚠️ has `.ts` but not exported · ⊘ CSS/HTML only · 💀 dead/broken.

| Group | Component | Hydrate / binding | Status |
| --- | --- | --- | --- |
| atoms | `button` | `hydrateButton`, spec `string`, `data-size`/`data-variant` | ✅ |
| atoms | `icon` | — (CSS-only wrapper) | ⊘ |
| atoms | `tabs` | `hydrateTabs`, `no-binding`, `role=tablist` | ✅ |
| atoms | `segmented` | `hydrateSegmented`, `no-binding` | ✅ |
| atoms | `toggle` | `hydrateToggle` | ⚠️ not in `index.ts` |
| atoms | `slider` | — (no `.ts`) | ⊘ |
| inputs | `textfield` | `hydrateTextfield` | ✅ |
| inputs | `valuefield` | `hydrateValuefield` | ✅ |
| inputs | `textedit` | `hydrateTextedit` (largest; 7 `.ts` modules) | ✅ |
| inputs | `textrename` | `hydrateTextrename` — **missing `.spec.json`** | ✅ (spec gap) |
| choosers | `choice-tiles` | `hydrateChoiceTiles`, `string` | ✅ |
| choosers | `object-manager` | hand-written `.js` IIFE, array add/reorder/delete | ⊘ not in `index.ts` |
| choosers | `repeater` | hand-written `.js` IIFE (`window.Dieter`) | ⊘ not in `index.ts` |
| choosers | `bulk-edit` | `hydrateBulkEdit`, `row-path` | ✅ |
| dropdowns | `dropdown-fill` | `hydrateDropdownFill` (color/fill; largest dropdown) | ✅ |
| dropdowns | `dropdown-actions` | `hydrateDropdownActions`, `string` | ✅ |
| dropdowns | `dropdown-border` | `hydrateDropdownBorder`, `string` | ✅ |
| dropdowns | `dropdown-shadow` | `hydrateDropdownShadow`, `string` | ✅ |
| dropdowns | `dropdown-upload` | `hydrateDropdownUpload`, `meta-path` | ✅ |
| dropdowns | `dropdown-edit` | `hydrateDropdownEdit`, `no-binding` | ✅ |
| dropdowns | `menuactions` | `hydrateMenuactions`, `string` | ✅ |
| dropdowns | `popaddlink` | `hydratePopAddLink` | ✅ |
| composites | `popover` | — (CSS/HTML/spec; container) | ⊘ |
| activity | `agent-activity` | — (transient narration strip) | ⊘ |
| other | `shared/` | helpers (`account-assets`, `dropdownToggle`) — not rendered | — |

## Component Contract

Every ToolDrawer field type has one inspectable Dieter contract: stencil, spec,
CSS, and behavior source only when native behavior is insufficient. A missing
required spec is a failure, not optional success. Explicit presentation-only
primitives such as `icon` are named exceptions, not a second contract.

The component-level product law is settled:

- Delete `textrename`; it has no current product consumer.
- Keep Toggle as a native checkbox HTML/CSS/spec contract and delete its unused
  custom Enter-key hydrator.
- Keep `repeater` and `object-manager` distinct. Repeater edits nested items
  inline; Object Manager reorders/deletes top-level objects in a dialog. Their
  real component dependencies must be declared. A JS-to-TS rewrite requires a
  behavior reason.
- Convert the six fake dropdown triggers to native buttons while preserving
  their product behavior.
- `dropdown-actions` survives as a choice/listbox popover. Delete its dead
  footer/apply-action branch; do not keep invalid interactive buttons inside a
  listbox for hypothetical compatibility.
- Remove Object Manager's accumulating backdrop listener.

Bulk Edit and Object Manager follow the exact dismissal contract in
[`dialogs-and-modals.md`](dialogs-and-modals.md). Saving either dialog applies
local edits to Bob's working state; account persistence remains Bob's separate
Save command.

Per-component source documentation records markup, `data-*` attributes,
binding, behavior/hydration, variants, sizes, states, and semantics. Step 6 maps
the exact source lines that diverge from this contract; it does not reopen the
contract.

## Native Operational Fields And Tables

Dieter owns one small visual/state contract for native operational `input`,
`select`, and `textarea` controls. Apps own labels, validation copy, values,
layout, and behavior. This contract preserves Roma's current bordered-field
appearance and does not turn Bob's compact ToolDrawer `textfield` into a generic
application form.

Dieter also owns one small operational-table visual base: width, alignment,
borders, base spacing, and horizontal overflow. Roma owns table data and state.
DevStudio retains policy-specific density, sticky headers, token columns, and
editable-cell composition. Dieter does not own sorting, pagination, data policy,
or a React table abstraction.

## Tooltip Contract

Unfamiliar icon-only actions use one small Dieter tooltip contract. The tooltip
appears on hover and keyboard focus while the control retains its accessible
name. Native `title` is not the designed tooltip system. This contract does not
create a tooltip framework or move product copy into Dieter.

## Per-Component Consumption

The composites (`repeater`, `object-manager`, `bulk-edit`, `tabs`, `popaddlink`,
`menuactions`) are editor controls rendered in Bob's ToolDrawer.

Component color consumption follows [`color.md`](color.md): structural chrome
uses its role tokens and state formulas; user-authored color controls keep their
own product values. This document owns the component contract; the 126I
execution PRD maps component-by-component adoption.

Component icon slots follow [`iconography.md`](iconography.md): use approved
Dieter icon names through the owning consumer lane, keep `currentColor`, keep
state on the parent/control, and put icon-only control names on the control.
The `icon` component is a CSS-only `diet-icon` wrapper with numeric glyph sizes.
The 126I execution PRD owns component-by-component API cleanup beyond those
iconography rules.

## Honest gaps

- `textrename` has no current product consumer and is an execution deletion target;
  do not add a spec to preserve it.
- `object-manager` and `repeater` are proven distinct active workflows: the
  former manages top-level object reorder/delete in a dialog, while the latter
  edits nested items inline. The 126I execution PRD must map their exact
  dependencies rather than merging them.
- Toggle's unused custom Enter-key hydrator is a deletion target; native
  checkbox behavior survives.
- Six fake dropdown triggers must become native buttons.
- The dead `dropdown-actions` footer/apply branch must be deleted.
- Object Manager's accumulating backdrop listener must be removed.
- Native operational fields, the operational-table visual base, and the tooltip
  contract must be added without creating generic form, table, or overlay
  frameworks.

Current inventory detail: 24 CSS-backed runtime components are emitted in the
Dieter manifest; `shared/` contains helpers and is not a rendered component.
`command-activity` is absent from current and tracked source. Historical 126
audits that mention it remain point-in-time evidence, not current catalog truth.
