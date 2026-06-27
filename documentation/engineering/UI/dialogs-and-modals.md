# Dialogs and modals in Clickeen

**Living, canonical reference — the overlay system.**
Seeded 2026-06-27 from the as-built code; improved in place as UI program 126 executes. Owns the overlay *system* (modal/dialog/popover rules); the per-component API is in [`components.md`](components.md), the a11y contract in [`accessibility.md`](accessibility.md), flow triggers in [`interactions.md`](interactions.md).

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).

## What exists today

- **`bulk-edit` modal** — the correct pattern: `role="dialog" aria-modal="true"`,
  `[hidden]`-toggled, with header/body structure. The reference to converge toward.
- **`object-manager` modal** — `[hidden]`-toggled, but **missing** `role=dialog` /
  `aria-modal`. (a11y gap — see [`accessibility.md`](accessibility.md).)
- **`textedit` / `dropdown-edit`** — `aria-haspopup="dialog"` trigger + a
  `.diet-popover` `role="dialog"` panel.
- **`popover`** — CSS/HTML/spec container; the shared overlay substrate.
- **`popaddlink`** — a popover-based link adder.
- **Roma parallel** — `.roma-modal` / `.roma-modal-backdrop` in `roma.css` (the
  system 126D retires in favor of a shared `Modal` primitive).
- **Upgrade popup** — the PRD 125 monetization modal (click → 402 → popup).

## The system rules (the layer this doc must declare — largely TBD today)

A correct overlay in clickeen must: trap focus while open, return focus on close,
close on escape + backdrop click, scroll-lock the page behind, manage stacking
order, announce via `aria-modal`/`role=dialog`, and honor `prefers-reduced-motion`
for enter/exit. **Most of these are not verified implemented** — the 126 series is
where they become declared, owned rules, not assumed.

## Honest gaps

- **No focus-trap / return-focus / scroll-lock verified** anywhere — likely the
  biggest overlay gap (the canonical corpus-median failure).
- **No z-index system** — raw `z-index` literals (1, 2, 3, 12, 1000) across
  component CSS; stacking is ad-hoc, which is exactly what breaks overlays. A
  stacking-order scale is a candidate 126A deliverable.
- **Modal ARIA inconsistent** — `bulk-edit` correct, `object-manager` not.
- **Roma convergence** — retire `.roma-modal` onto the shared `Modal` primitive
  (one modal system, not `.roma-modal` + `diet-modal` + ad-hoc).
