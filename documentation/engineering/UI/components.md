# Dieter components — the library reference

**Living, canonical reference — how to use each component.**
Seeded 2026-06-27 from `dieter/components/*`; improved in place as UI program
126 executes. Track PRD: `126I__PRD__Components.md`.

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Source of truth:** `dieter/components/*` (each component's `.css`/`.html`/`.spec.json`/`.ts`) and `dieter/components/index.ts`.
- System mechanics (hydration model, spec binding, build): see [`dieter.md`](dieter.md). This doc is the per-component lookup; that doc explains the system once.

## Catalog (27 component dirs + shared)

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
| activity | `command-activity` | — | 💀 empty dir, zero refs |
| other | `shared/` | helpers (`account-assets`, `dropdownToggle`) — not rendered | — |

## Per-component usage

Each component earns a section with: markup stencil, `data-*` attributes, hydrate
call, binding model, variants/sizes/states, ARIA, and a before/after visual. The
catalog above is the index; the detail lands here as 126I audits each
component. The composites (`repeater`, `object-manager`, `bulk-edit`, `tabs`,
`popaddlink`, `menuactions`) are the editor controls rendered in Bob's ToolDrawer.

Component color consumption follows [`color.md`](color.md): structural chrome
uses 126B role tokens and state formulas; user-authored color controls keep their
own product values. 126I owns component-by-component adoption when each component
is executed.

Component icon slots follow [`iconography.md`](iconography.md): use approved
Dieter icon names through the owning consumer lane, keep `currentColor`, keep
state on the parent/control, and put icon-only control names on the control.
The `icon` component is a CSS-only `diet-icon` wrapper with numeric glyph sizes.
126I owns component-by-component API cleanup beyond those 126C rules.

## Honest gaps

- `command-activity` is dead — remove (coordinate with `admin/src/main.ts:23,258`
  if any hydrate lingers, per the DevStudio sanity-pass).
- `textrename` is missing `.spec.json`; 126I owns the component decision.
- `object-manager` vs `repeater` distinction (both in the tool drawer) is not yet
  documented — read their ToolDrawer usage during 126I before claiming overlap.
