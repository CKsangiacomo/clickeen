# Dieter components — the library reference

**Living, canonical reference — how to use each component.**

- Canonical doctrine: this document.
- Execution PRD: [`126I__PRD__Components.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126I__PRD__Components.md).
- **Source of truth:** `dieter/components/*` (the `.css`, `.html`, `.spec.json`,
  `.ts`, or `.js` files present for each declared contract) and
  `dieter/components/index.ts`.
- System mechanics (hydration model, spec binding, build): see [`dieter.md`](dieter.md). This doc is the per-component lookup; that doc explains the system once.

## Catalog (28 non-empty source directories including `shared`)

Legend: ✅ exported from `index.ts` · Direct host import · ⊘ CSS/HTML only.

| Group | Component | Hydrate / binding | Status |
| --- | --- | --- | --- |
| atoms | `button` | `hydrateButton`, spec `string`, `data-size`/`data-variant` | ✅ |
| atoms | `icon` | — (CSS-only wrapper) | ⊘ |
| atoms | `tabs` | `hydrateTabs`, `no-binding`, `role=tablist` | ✅ |
| atoms | `segmented` | `hydrateSegmented`, `no-binding` | ✅ |
| atoms | `toggle` | native checkbox behavior | ⊘ |
| atoms | `slider` | — (no `.ts`) | ⊘ |
| inputs | `textfield` | `hydrateTextfield` | ✅ |
| inputs | `valuefield` | `hydrateValuefield` | ✅ |
| inputs | `textedit` | `hydrateTextedit` (largest; 7 `.ts` modules) | ✅ |
| choosers | `choice-tiles` | `hydrateChoiceTiles`, `string` | ✅ |
| choosers | `object-manager` | direct ESM `hydrateObjectManager`, array add/reorder/delete | Direct host import |
| choosers | `repeater` | direct ESM `hydrateRepeater` | Direct host import |
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
| structural | `table` | semantic table visual base and overflow shell | ⊘ |
| structural | `popup` | blocking native-dialog visual structure | ⊘ |
| activity | `agent-activity` | — (transient narration strip) | ⊘ |
| operational | `operational-field` | ordinary app field visual base | ⊘ |
| operational | `tooltip` | CSS label from `data-tooltip` | ⊘ |
| other | `shared/` | helpers (`account-assets`, `dialog-lifecycle`, `dropdownToggle`) — not rendered | — |

## Component Contract

Every ToolDrawer field type has one inspectable Dieter contract: stencil, spec,
CSS, and behavior source only when native behavior is insufficient. A missing
required spec is a failure, not optional success. Explicit presentation-only
primitives such as `icon` are named exceptions, not a second contract.

The component-level product law is implemented:

- `textrename` is deleted because it had no product consumer.
- Toggle is a native checkbox HTML/CSS/spec contract with no custom hydrator.
- Keep `repeater` and `object-manager` distinct. Repeater edits nested items
  inline; Object Manager reorders/deletes top-level objects in a dialog. Their
  real component dependencies must be declared. A JS-to-TS rewrite requires a
  behavior reason.
- The six dropdown triggers and Bulk Edit's copied upload trigger are native
  buttons.
- `dropdown-actions` is one immediate-choice listbox workflow; its dead
  footer/apply branch is gone.
- Object Manager dialog lifecycle remains owned by the dialog contract.

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

Dieter Table owns width, alignment, borders, base spacing, and horizontal
overflow. Roma owns table data and state. DevStudio retains policy-specific
columns, editable-cell composition, data, and mutation behavior. Dieter does
not own sorting, pagination, data policy, or a React table abstraction.
DevStudio's token editor consumes `operational-field`; Dieter, Roma, and
DevStudio tables consume `table`.

Table body and row-header cells use the shared surface; only column headers use
the muted surface. Table is a borderless `2xl` surface with floating elevation
and direct role-border horizontal row dividers, with no vertical rules or zebra
stripes. Cells use `--space-2` block and `--space-4` inline padding. Column
headers use `label-s`; every body `th` and `td` uses `body-s`; action controls
retain their Dieter component typography. Technical values receive no separate
monospace treatment. Preview and action columns use the small Table-owned
composition classes rather than consumer-local base styling.

Dieter Popup owns the blocking native `<dialog>` appearance and structural
slots: header, body, footer, and actions, with small, medium, and large sizes.
Product owners keep workflow state, copy, validation, persistence, and the
accepted dismissal behavior. Bulk Edit, Object Manager, DevStudio token
editing, Roma blocking dialogs, and Bob's plan-limit prompt consume Popup
without adding a second modal framework.

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

Current inventory detail: Dieter components are source modules consumed
directly by Bob, Roma, and DevStudio; there is no runtime component manifest.
`shared/` contains helpers and is not a rendered component.
`command-activity` and `operational-table` are absent from current tracked
source. DevStudio generates 24 source-backed component pages. Historical 126
audits remain point-in-time evidence.
