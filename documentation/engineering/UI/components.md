# Dieter components — the library reference

**Living, canonical reference — how to use each component.**
Seeded 2026-06-27 from `dieter/components/*`; improved in place as UI program 126 (track 126B) executes. Track PRD: `126B__PRD__Components.md`.

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

## Per-component usage (to be filled during 126B)

Each component earns a section with: markup stencil, `data-*` attributes, hydrate
call, binding model, variants/sizes/states, ARIA, and a before/after visual. The
catalog above is the index; the detail lands here as track 126B audits each
component. The composites (`repeater`, `object-manager`, `bulk-edit`, `tabs`,
`popaddlink`, `menuactions`) are the editor controls rendered in Bob's ToolDrawer.

## Honest gaps

- `command-activity` is dead — remove (coordinate with `admin/src/main.ts:23,258`
  if any hydrate lingers, per the DevStudio sanity-pass).
- `textrename` is missing `.spec.json` and its removal is gated on
  `admin/src/main.ts:23,258` (see the 126C corrections).
- `object-manager` vs `repeater` distinction (both in the tool drawer) is not yet
  documented — read their ToolDrawer usage during 126B before claiming overlap.
