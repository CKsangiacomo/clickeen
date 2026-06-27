# 126A — PRD: Accessibility

Status: DIRECTIONAL — fill after the accessibility audit (`audits/126A__Audit__Accessibility.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: `engineering/UI/` folder order; DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/accessibility.md` (canonical reference; this PRD drives it).

## Role
The cross-cutting a11y contract — the single owner of focus, touch, ARIA, keyboard, contrast, and reduced-motion across every doll.

## Precondition
Run the real accessibility audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- Focus-ring + touch-target tokens (`--focus-ring-*`, `--min-touch-target`) and whether every interactive control honors them.
- ARIA semantics per component (tabs, dropdowns, modals, etc.).
- Keyboard navigation (arrow keys, escape, return focus).
- Color-contrast pairs (the `-contrast` tokens) vs WCAG.
- `prefers-reduced-motion` coverage; `.sr-only`.
- Overlay a11y (focus trap, `aria-modal`, scroll-lock) — coordinates with 126D.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
