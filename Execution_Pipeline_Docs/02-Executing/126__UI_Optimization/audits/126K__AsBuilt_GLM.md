# 126K — As-built audit: Dialogs and Modals (GLM, Phase-1 step 1)

> GLM independent pass. **Not converged.** Evidence from 126A accessibility audit + component greps.

## Overlay inventory
- **bulk-edit modal** (`bulk-edit.html:18`): `role="dialog" aria-modal="true"`, `[hidden]`-toggle, Escape (`bulk-edit.ts:342`), focus first input on open (`:329-335`). **Gold standard.**
- **object-manager modal** (`object-manager.html:38`): `[hidden]`-toggle, **NO** `role="dialog"`/`aria-modal`. No Escape, no trap. **Gap.**
- **textedit/dropdown-edit/upload popovers** (`textedit.html:13`, `dropdown-edit.html:7`, `dropdown-upload.html:38`): `role="dialog"`, no `aria-modal` (appropriate for popovers).
- **popover container** (`popover.html`): CSS-only, no `role="dialog"`/`aria-haspopup`.
- **Roma modals** (4: assets, pages, widgets, account-notice): `role="dialog" aria-modal="true"` but **NO Escape, NO trap, NO outside-click, NO focus restore.**
- **Bob UpsellPopup** (`UpsellPopup.tsx:41`): `role="dialog" aria-modal="true"`, Escape (`:23-29`), outside-click (`:38`), autofocus. **Best bob modal** but no focus restore.
- **dropdownToggle.ts** (`:89-95`): shared Escape + outside-click for dropdowns (not modals).

## z-index — no system
Raw literals: 0/1/2/3/12/1000. No `--z-*` tokens. Ad-hoc stacking.

## Focus trap / return / scroll-lock
**NOT verified in ANY overlay.** Only markup-level `role=dialog`/`aria-modal`. No JS focus-trap, no scroll-lock, no restore-on-close (except dropdown-actions → `trigger.focus()`).

## Gaps
- No shared Modal primitive.
- Focus trap/return/scroll-lock unverified everywhere.
- z-index unmanaged.
- Roma `.roma-modal` must retire onto shared `Modal`.

— end GLM as-built, 126K.
