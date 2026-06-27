# Accessibility in Clickeen

**Living, canonical reference — the a11y contract.**
Seeded 2026-06-27 from the as-built tokens/code; improved in place as UI program 126 executes. This doc is the single owner of the cross-cutting a11y guarantee (it touches [`color.md`](color.md), [`dieter.md`](dieter.md), [`components.md`](components.md), [`motion.md`](motion.md), [`dialogs-and-modals.md`](dialogs-and-modals.md)).

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Sources:** `dieter/tokens/dieter-foundation-tokens.css` (focus/ergonomics, `.sr-only`, reduced-motion) + component `.html`/`.ts` (ARIA).

## What is tokenized today

```text
--focus-ring-width:   2px
--focus-ring-offset:  2px
--focus-ring-color:   var(--color-system-blue)   /* from color.md */
--min-touch-target:   44px
```
- `.sr-only` utility (foundation:92) — screen-reader-only content.
- `@media (prefers-reduced-motion: reduce)` guard (foundation:99) — see [`motion.md`](motion.md).
- Per-hue `-contrast` variants in [`color.md`](color.md) — intended for accessible text-on-tint.

## ARIA semantics already in the components (verified)

Real semantics ship in several components — this is a strength to preserve:
- `tabs` — `role="tablist"`, `role="tab"`, `aria-selected`, `aria-label`.
- `dropdown-shadow` (and family) — `role="button"`/`role="listbox"`, `aria-haspopup`, `aria-expanded`, `aria-pressed`, `aria-hidden`, `aria-labelledby`/`aria-label`.
- `bulk-edit` modal — `role="dialog" aria-modal="true"` (the gold-standard pattern).
- `textedit` / `dropdown-edit` — `aria-haspopup="dialog"` + `role="dialog"` popovers.

## Honest gaps (verification items for the a11y pass — do not claim conformance yet)

- **No formal WCAG audit.** Contrast `-contrast` tokens exist but whether every
  pair passes AA/AAA is unverified.
- **Modal ARIA is inconsistent.** `bulk-edit`'s modal is correct
  (`role=dialog aria-modal=true`); `object-manager`'s modal is **not** — it lacks
  `role=dialog`/`aria-modal`. See [`dialogs-and-modals.md`](dialogs-and-modals.md).
- **Focus-trap / return-focus / scroll-lock** for overlays are not verified
  implemented anywhere — likely missing (the corpus-median failure).
- **Keyboard navigation per component** (arrow keys in `tabs`/`segmented`/listboxes,
  escape in overlays) is largely unverified.
- `--min-touch-target: 44px` is defined; whether every interactive control honors
  it is unverified.

The a11y pass's job is to make each of these either green or an explicit, owned
gap — not to assert conformance that hasn't been measured.
