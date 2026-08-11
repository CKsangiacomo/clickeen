# Dieter components — the library reference

**Living, canonical reference — how to use each component.**

- Canonical doctrine: this document.
- Execution PRD: [`126I__PRD__Components.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126I__PRD__Components.md).
- **Source of truth:** `dieter/components/*` (the `.css`, `.html`, `.spec.json`,
  `.ts`, or `.js` files present for each declared contract) and
  `dieter/components/index.ts`.
- System mechanics (hydration model, spec binding, build): see [`dieter.md`](dieter.md). This doc is the per-component lookup; that doc explains the system once.

## Catalog (27 non-empty source directories including `shared`)

Legend: ✅ exported from `index.ts` · Direct host import · ⊘ no custom hydrator.

| Group | Component | Hydrate / binding | Status |
| --- | --- | --- | --- |
| atoms | `button` | Native button/link, spec `string`, `data-size`/`data-type` | ⊘ |
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
| dropdowns | `dropdown-actions` | `hydrateDropdownActions` / `destroyDropdownActions`, `string` | ✅ |
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
| operational | `tooltip` | CSS label from `data-tooltip` | ⊘ |
| other | `shared/` | helpers (`account-assets`, `dialog-lifecycle`, `dropdownToggle`) — not rendered | — |

## Component Contract

Every ToolDrawer field type has one inspectable Dieter contract: stencil, spec,
CSS, and behavior source only when native behavior is insufficient. A missing
required spec is a failure, not optional success. Explicit presentation-only
primitives such as `icon` are named exceptions, not a second contract.

The component-level product law is implemented:

- Button is one `.diet-button` primitive. Its direct children determine whether
  it is text-only, icon-only, or icon-and-text; those are not separate Button
  classes or variants.
- Button requires `data-size="small|medium|large"` and
  `data-type="primary|secondary|tertiary|quaternary"`. Type expresses visual
  hierarchy, not the wording or function of the action: primary is the filled
  blue emphasis, secondary is the quiet gray treatment, and tertiary is the
  blue outlined treatment inherited from the former line Button. Quaternary
  has no resting background or border and reveals its state treatment on
  interaction. Size owns the Button box, spacing, radius, and text typography.
  Small, medium, and large use the measured proportion set respectively:
  `1.5rem/1.75rem/2.5rem` height, `.75rem/.875rem/1rem` text,
  `.25rem/.375rem/.5rem` child gap, and `.5rem/.5rem/1rem` inline padding.
  Their proportional radii are `.1875rem/.25rem/.375rem`.
- Button composition is explicit and bounded: omit Icon for text-only, omit
  label for icon-only, or compose both. Direct child order places an Icon before
  or after the label; Button CSS does not reorder children. Icon-only Buttons
  put their accessible name on the Button. Consumers do not invent another
  visual type in local CSS or create a separate icon-button component.
- A child `.diet-icon` owns an explicit glyph size independently through numeric
  `data-size`. When that attribute is absent, Button size supplies the direct
  Icon's proportional default: `.75rem` for small, `1rem` for medium, and
  `1.25rem` for large. An explicit numeric Icon size remains authoritative when
  a composition deliberately needs it. Button labels have no hidden padding.
- Choice Tiles is a two- or three-option string chooser with one `sm|md|lg`
  size authority on its root. Small, medium, and large use proportional
  `4rem/4.5rem/5rem` minimum heights, `.5rem/.5rem/.75rem` block padding,
  `.25rem/.5rem/.5rem` internal gaps, and `.25rem/.375rem/.5rem` radii.
  Inline padding remains `.5rem`; the row gap is `.25rem` at small and `.5rem`
  at medium/large so the constrained ToolDrawer width remains usable. Its
  unsized Icons use the tile-specific
  `1rem/1.25rem/1.25rem` ladder instead of a second rendered Icon-size input.
  Large uses `0.9375rem` text with a `1.25rem` line height; small and medium
  retain their corresponding Button typography.
  Labels wrap rather than truncate, so the caller's exact wording remains
  visible. Dieter owns no group or option words; Widget ToolDrawer instances
  supply both from their adjacent label file.
- Dropdown Actions is an immediate string chooser. At rest it shows the
  caller-supplied field label and current value; its hover treatment discloses
  the control without adding a permanent chevron. Opening it places the
  existing Popover over the row, repeats only the caller-supplied label in the
  header, and presents Menu Actions. Choosing an option updates the bound
  value and closes the Popover immediately; there is no Apply footer.
  The attached Popover inherits the row's `sm|md|lg` radius. Opening the
  control does not add a separate blue border or tint to the covered row; the
  Popover itself communicates the open state.
  `data-size="sm|md|lg"` is the component's single geometry and typography
  authority: the trigger is `1.25rem/1.5rem/1.75rem` high and uses
  `.6875rem/.8125rem/.875rem` text. Current ToolDrawer instances use `md`.
  The component owns no visible wording: label, placeholder, group labels,
  option labels, and badges are caller inputs. Its selected checkmark follows
  the Menu Actions size ladder at `.75rem/1rem/1.25rem`; it is not pinned to a
  separate glyph size.
- Menu Actions remains a separate menu-row primitive with its existing
  `sm|md|lg` API. Low-level geometry tokens remain internal source mechanics.
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
- `dropdown-edit` shows the leading portion of long closed-trigger text and
  applies an end ellipsis when the row cannot fit the complete value.
- Object Manager dialog lifecycle remains owned by the dialog contract.

Bulk Edit and Object Manager follow the exact dismissal contract in
[`dialogs-and-modals.md`](dialogs-and-modals.md). Saving either dialog applies
local edits to Bob's working state; account persistence remains Bob's separate
Save command.

Dieter Popover owns the attached floating surface, padding, radius, shadow,
header/body structure, and open-state presentation. Its standard header is a
caller-supplied label only; it does not invent a decorative header Icon or
visible copy. Header and body share the Popover's outer inline alignment rather
than applying a second header inset. The caller owns the trigger, open state,
body content, selection, and any real workflow action. A component with a
genuine close or command action composes that action explicitly rather than
receiving a decorative Popover control.

Per-component source documentation records markup, `data-*` attributes,
binding, behavior/hydration, variants, sizes, states, and semantics. Step 6 maps
the exact source lines that diverge from this contract; it does not reopen the
contract.

## Application Inputs And Tables

Applications compose forms from Dieter's actual input contracts. Single-line
text uses `textfield`, immediate choices use `dropdown-actions`, and multiline
content uses `textedit`. Apps retain labels, validation copy, values, layout,
and product behavior; they do not create a parallel generic field family.

Dieter Table owns width, alignment, borders, base spacing, and horizontal
overflow. Roma owns table data and state. DevStudio retains policy-specific
columns, editable-cell composition, data, and mutation behavior. Dieter does
not own sorting, pagination, data policy, or a React table abstraction.
DevStudio and Roma consume those input contracts directly. Dieter, Roma, and
DevStudio tables consume `table`.

Table body and row-header cells use the shared surface; only column headers use
the muted surface. Table is a borderless `2xl` surface with floating elevation
and direct role-border horizontal row dividers, with no vertical rules or zebra
stripes. Cells use `--space-2` block and `--space-4` inline padding. Column
headers use `label-s`; every body `th` and `td` uses `body-s`; action controls
retain their Dieter component typography. Technical values receive no separate
monospace treatment. Preview and action columns use the small Table-owned
composition classes rather than consumer-local base styling.

Sortable headers remain app-owned behavior composed inside Dieter Table. Their
control is a `small` quaternary `.diet-button` with a 12px `.diet-icon`:
inactive columns use
`--color-system-gray-3`, while the active ascending or descending column uses
`--color-system-black`. Dieter owns that presentation through `aria-sort`; apps
own the selected column, direction, and row ordering.

Dieter Popup owns the blocking native `<dialog>` appearance and structural
slots: header, body, footer, and actions, with small, medium, and large sizes.
Product owners keep workflow state, copy, validation, persistence, and the
accepted dismissal behavior. Bulk Edit, Object Manager, DevStudio token
editing, Roma blocking dialogs, and Bob's plan-limit prompt consume Popup
without adding a second modal framework.

## Agent Activity Contract

Agent Activity renders one caller-supplied title and one or more
caller-supplied narration rows. Dieter owns the multi-row structure, `sm`/`md`
sizes, active presentation, and transient status semantics; it owns none of the
visible words. In Bob's ToolDrawer, the open widget artifact supplies the
static title and Translation Agent events supply the dynamic rows.

The active component uses `--color-system-purple-5` as its surface and a thin
animated gradient stroke composed from existing system colors. The gradient is
activity presentation, not progress measurement. Dieter's global reduced-motion
guard applies to the animation.

## Tooltip Contract

Unfamiliar icon-only actions use one small Dieter tooltip contract. The tooltip
appears on hover while the control retains its accessible name. Native `title`
is not the designed tooltip system. This contract does not
create a tooltip framework or move product copy into Dieter.

## Per-Component Consumption

The composites (`repeater`, `object-manager`, `bulk-edit`, `tabs`, `popaddlink`,
`menuactions`) are editor controls rendered in Bob's ToolDrawer.

Component color consumption follows [`color.md`](color.md): structural chrome
uses its role tokens and state formulas; user-authored color controls keep their
own product values. This document owns the component contract; the 126I
execution PRD maps component-by-component adoption.

Component icon slots follow [`iconography.md`](iconography.md): declare Dieter
icon names through the owning component input, keep `currentColor`, keep state
on the parent/control, and put icon-only control names on the control.
The `icon` component is a CSS-only `diet-icon` wrapper with numeric glyph sizes.
The 126I execution PRD owns component-by-component API cleanup beyond those
iconography rules.

Current inventory detail: Dieter components are source modules consumed
directly by Bob, Roma, and DevStudio; there is no runtime component manifest.
`shared/` contains helpers and is not a rendered component.
`command-activity` and `operational-table` are absent from current tracked
source. DevStudio generates 24 source-backed component pages. Historical 126
audits remain point-in-time evidence.
