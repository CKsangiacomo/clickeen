# 126K — PRD: Dialogs and Modals

Status: DIRECTIONAL — fill after the dialogs-and-modals audit (`audits/126K__Audit__Dialogs_and_Modals.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: dependency order (MAMA §7); DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/dialogs-and-modals.md` (canonical reference; this PRD drives it).

## Role
The overlay system — modal/dialog/popover mechanics (focus trap, stacking, scroll-lock, enter/exit), not any single component.

## Precondition
Run the real dialogs-and-modals audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- Overlay rules: focus trap, return focus, escape, backdrop click, scroll-lock, stacking order, `aria-modal`/`role=dialog`, reduced-motion enter/exit.
- The component inventory (`bulk-edit`, `object-manager`, `popover`, `popaddlink`, `textedit`/`dropdown-edit` dialogs) and which rules each satisfies.
- z-index (no system today — raw literals); a stacking-order scale is a candidate deliverable.
- Roma convergence: retire `.roma-modal` onto one shared `Modal` primitive.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
