# 126I — PRD: Components

Status: DIRECTIONAL — fill after the components audit (`audits/126I__Audit__Components.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: dependency order (MAMA §7); DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/components.md` (canonical reference; this PRD drives it).

## Role
The component library — the pivot. ~27 Dieter components composing every domain beneath (tokens, accessibility, iconography, interactions, motion, ops, dieter); consumed by surfaces (126J) and the screen refactors (126L/126M).

## Precondition
Run the real components audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- All ~27 components: per-component preserve/fix; the hydration + spec-binding model; component-local token patterns (`--seg-*`, `--btn-*`, etc.).
- Drift: `dropdown-fill` raw hex, `textedit` raw rgba, hardcoded modal/popover widths, behavior-in-markup stencils.
- Dead/broken: `textrename` (removal must also delete `admin/src/main.ts:23,258`), `command-activity` (empty).
- Open: `repeater` vs `object-manager` distinction (read ToolDrawer usage before claiming overlap).

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Token changes (126B/126D/126F/126H own).
- Screens (126L/126M).
